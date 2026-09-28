import { describe, expect, it } from "vitest";
import type { ContentIndex } from "@/lib/content/summary";
import { addDays, daysBetween, localDateKey } from "@/lib/dates";
import { emptyProgress, type Progress } from "./schema";
import { computePace, computeStats, computeStreak, dayState } from "./stats";

const INDEX: ContentIndex = {
  weeks: [{ week: 1, title: "One" }],
  days: [
    { day: 1, week: 1, title: "A", domain: "foundations", estMinutes: 30, tasks: [{ id: "d01-t1", estMinutes: 10 }, { id: "d01-t2", estMinutes: 20 }] },
    { day: 2, week: 1, title: "B", domain: "claude-code", estMinutes: 20, tasks: [{ id: "d02-t1", estMinutes: 10 }, { id: "d02-t2", estMinutes: 10 }] },
    { day: 3, week: 1, title: "C", domain: "exam-practice", estMinutes: 15, tasks: [{ id: "d03-t1", estMinutes: 15 }] },
  ],
};

function progressWith(done: Record<string, string>, extra: Partial<Progress> = {}): Progress {
  const base = emptyProgress(new Date("2026-10-01T00:00:00Z"));
  const tasks = Object.fromEntries(Object.entries(done).map(([id, at]) => [id, { done: true, completedAt: at }]));
  return { ...base, ...extra, tasks };
}

describe("dates", () => {
  it("maps an instant to the local calendar date, including UTC+14", () => {
    expect(localDateKey("2026-10-01T10:30:00Z", "UTC")).toBe("2026-10-01");
    expect(localDateKey("2026-10-01T10:30:00Z", "Pacific/Kiritimati")).toBe("2026-10-02");
    expect(localDateKey("2026-10-01T10:30:00Z", "Pacific/Pago_Pago")).toBe("2026-09-30");
  });

  it("counts calendar days across DST changes", () => {
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-10-05", "2026-10-01")).toBe(-4);
  });
});

describe("dayState", () => {
  it("reports not started, in progress and done", () => {
    const day = INDEX.days[0]!;
    expect(dayState(day, progressWith({})).status).toBe("not-started");
    const partial = dayState(day, progressWith({ "d01-t2": "2026-10-01T09:00:00Z" }));
    expect(partial).toEqual({ status: "in-progress", tasks: { done: 1, total: 2 }, minutes: { done: 20, total: 30 } });
    const done = dayState(day, progressWith({ "d01-t1": "2026-10-01T09:00:00Z", "d01-t2": "2026-10-01T09:00:00Z" }));
    expect(done.status).toBe("done");
  });
});

describe("computePace", () => {
  it("needs a start date", () => expect(computePace(null, 0, 42)).toEqual({ kind: "unscheduled" }));

  it("is on track on the start date, and after finishing today's day", () => {
    expect(computePace(0, 0, 42)).toEqual({ kind: "on-track" });
    expect(computePace(0, 1, 42)).toEqual({ kind: "on-track" });
    expect(computePace(3, 4, 42)).toEqual({ kind: "on-track" });
  });

  it("is ahead only past today's day", () => {
    expect(computePace(0, 2, 42)).toEqual({ kind: "ahead", days: 1 });
    expect(computePace(3, 7, 42)).toEqual({ kind: "ahead", days: 3 });
  });

  it("is behind by the missed days, capped at the plan length", () => {
    expect(computePace(3, 1, 42)).toEqual({ kind: "behind", days: 2 });
    expect(computePace(100, 40, 42)).toEqual({ kind: "behind", days: 2 });
  });

  it("treats a future start date as no days due", () => {
    expect(computePace(-3, 0, 42)).toEqual({ kind: "on-track" });
  });

  it("is finished when every day is done", () => expect(computePace(5, 42, 42)).toEqual({ kind: "finished" }));
});

describe("computeStreak", () => {
  it("counts back from today, or from yesterday when today has nothing yet", () => {
    const progress = progressWith({
      "d01-t1": "2026-10-01T12:00:00Z",
      "d01-t2": "2026-10-02T12:00:00Z",
      "d02-t1": "2026-10-03T12:00:00Z",
    });
    expect(computeStreak(progress, "2026-10-03", "UTC")).toEqual({ current: 3, activeToday: true });
    expect(computeStreak(progress, "2026-10-04", "UTC")).toEqual({ current: 3, activeToday: false });
    expect(computeStreak(progress, "2026-10-05", "UTC")).toEqual({ current: 0, activeToday: false });
  });

  it("uses the local calendar, not UTC dates", () => {
    // 04:30 UTC on Nov 2 is still Nov 1 (23:30, after the DST change) in New York.
    const progress = progressWith({ "d01-t1": "2026-11-02T04:30:00Z" });
    expect(computeStreak(progress, "2026-11-03", "America/New_York").current).toBe(0);
    expect(computeStreak(progress, "2026-11-03", "UTC").current).toBe(1);
  });

  it("joins days across a DST change", () => {
    const progress = progressWith({
      "d01-t1": "2026-03-08T04:00:00Z", // Mar 7, 23:00 EST
      "d01-t2": "2026-03-09T03:30:00Z", // Mar 8, 23:30 EDT
    });
    expect(computeStreak(progress, "2026-03-08", "America/New_York")).toEqual({ current: 2, activeToday: true });
  });
});

describe("computeStats", () => {
  it("totals tasks, minutes, days, weeks and domains", () => {
    const progress = progressWith({ "d01-t1": "2026-10-01T09:00:00Z", "d01-t2": "2026-10-01T09:30:00Z", "d02-t1": "2026-10-02T09:00:00Z" });
    const stats = computeStats(INDEX, progress, new Date("2026-10-02T12:00:00Z"), "UTC");
    expect(stats.tasks).toEqual({ done: 3, total: 5 });
    expect(stats.minutes).toEqual({ done: 40, total: 65 });
    expect(stats.days).toEqual({ done: 1, total: 3 });
    expect(stats.byWeek[0]?.tasks).toEqual({ done: 3, total: 5 });
    expect(stats.byDomain.find((d) => d.domain === "claude-code")?.tasks).toEqual({ done: 1, total: 2 });
    expect(stats.today?.day).toBe(2);
  });

  it("has no today once everything is done", () => {
    const at = "2026-10-01T09:00:00Z";
    const progress = progressWith({ "d01-t1": at, "d01-t2": at, "d02-t1": at, "d02-t2": at, "d03-t1": at });
    const stats = computeStats(INDEX, progress, new Date(at), "UTC");
    expect(stats.today).toBeNull();
    expect(stats.pace).toEqual({ kind: "unscheduled" });
  });

  it("schedules from startDate in the viewer's time zone", () => {
    const progress = progressWith({}, { startDate: "2026-10-01" });
    const now = new Date("2026-10-01T10:00:00Z");
    // Still Sep 30 in Pago Pago (UTC−11): the plan starts tomorrow.
    expect(computeStats(INDEX, progress, now, "Pacific/Pago_Pago")).toMatchObject({ scheduledDay: null, startsIn: 1 });
    // Already Oct 2 in Kiritimati (UTC+14): day 2 is scheduled and day 1 is overdue.
    expect(computeStats(INDEX, progress, now, "Pacific/Kiritimati")).toMatchObject({
      scheduledDay: 2,
      startsIn: null,
      pace: { kind: "behind", days: 1 },
    });
  });

  it("ranks the weakest domains by average confidence, without exam practice", () => {
    const progress = progressWith(
      {},
      {
        days: {
          "1": { notes: "", confidence: 4 },
          "2": { notes: "", confidence: 2 },
          "3": { notes: "", confidence: 1 },
        },
      },
    );
    const stats = computeStats(INDEX, progress, new Date("2026-10-02T12:00:00Z"), "UTC");
    expect(stats.weakest).toEqual([
      { domain: "claude-code", average: 2, rated: 1 },
      { domain: "foundations", average: 4, rated: 1 },
    ]);
  });
});
