import { describe, expect, it } from "vitest";
import { applyOperation, applyOperations, describeOperations, OperationError, type ApplyContext } from "./apply";
import { emptyProgress, ProgressSchema, type Operation, type Progress } from "./schema";

const T0 = "2026-10-01T08:00:00.000Z";
const T1 = "2026-10-01T09:30:00.000Z";
const T2 = "2026-10-02T07:15:00.000Z";

function ctx(now = T1): ApplyContext {
  return { taskIds: new Set(["d01-t1", "d01-t2", "d02-t1"]), dayNumbers: new Set([1, 2]), now };
}

function fresh(): Progress {
  return emptyProgress(new Date(T0));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

describe("setTask", () => {
  it("marks a task done at the current time", () => {
    const next = applyOperation(fresh(), { type: "setTask", taskId: "d01-t1", done: true }, ctx());
    expect(next.tasks["d01-t1"]).toEqual({ done: true, completedAt: T1 });
    expect(next.updatedAt).toBe(T1);
  });

  it("keeps the original completedAt when the same op is applied again later", () => {
    const op: Operation = { type: "setTask", taskId: "d01-t1", done: true };
    const once = applyOperation(fresh(), op, ctx(T1));
    const twice = applyOperation(once, op, ctx(T2));
    expect(twice).toBe(once);
    expect(twice.tasks["d01-t1"]?.completedAt).toBe(T1);
  });

  it("marks a done task not done and clears completedAt", () => {
    const done = applyOperation(fresh(), { type: "setTask", taskId: "d01-t1", done: true }, ctx(T1));
    const undone = applyOperation(done, { type: "setTask", taskId: "d01-t1", done: false }, ctx(T2));
    expect(undone.tasks["d01-t1"]).toEqual({ done: false, completedAt: null });
    expect(undone.updatedAt).toBe(T2);
  });

  it("treats marking an untouched task not done as a no-op", () => {
    const start = fresh();
    expect(applyOperation(start, { type: "setTask", taskId: "d01-t1", done: false }, ctx())).toBe(start);
  });

  it("rejects a task that isn't in the content", () => {
    expect(() => applyOperation(fresh(), { type: "setTask", taskId: "d09-t9", done: true }, ctx())).toThrow(
      OperationError,
    );
  });
});

describe("setNotes and setConfidence", () => {
  it("create the day entry on first use", () => {
    const next = applyOperation(fresh(), { type: "setNotes", day: 1, notes: "Spend limit set" }, ctx());
    expect(next.days["1"]).toEqual({ notes: "Spend limit set", confidence: null });
    expect(next.updatedAt).toBe(T1);
  });

  it("change one field and keep the other", () => {
    const withNotes = applyOperation(fresh(), { type: "setNotes", day: 2, notes: "tokens ≠ words" }, ctx());
    const rated = applyOperation(withNotes, { type: "setConfidence", day: 2, value: 3 }, ctx());
    expect(rated.days["2"]).toEqual({ notes: "tokens ≠ words", confidence: 3 });
    const cleared = applyOperation(rated, { type: "setConfidence", day: 2, value: null }, ctx());
    expect(cleared.days["2"]).toEqual({ notes: "tokens ≠ words", confidence: null });
  });

  it("are no-ops when the value is unchanged, including blank notes on an untouched day", () => {
    const start = fresh();
    expect(applyOperation(start, { type: "setNotes", day: 1, notes: "" }, ctx())).toBe(start);
    expect(applyOperation(start, { type: "setConfidence", day: 1, value: null }, ctx())).toBe(start);
    const rated = applyOperation(start, { type: "setConfidence", day: 1, value: 5 }, ctx());
    expect(applyOperation(rated, { type: "setConfidence", day: 1, value: 5 }, ctx(T2))).toBe(rated);
  });

  it("reject days that aren't in the content", () => {
    expect(() => applyOperation(fresh(), { type: "setNotes", day: 3, notes: "x" }, ctx())).toThrow(OperationError);
    expect(() => applyOperation(fresh(), { type: "setConfidence", day: 3, value: 2 }, ctx())).toThrow(OperationError);
  });
});

describe("setStartDate", () => {
  it("sets and clears the start date", () => {
    const set = applyOperation(fresh(), { type: "setStartDate", date: "2026-10-01" }, ctx());
    expect(set.startDate).toBe("2026-10-01");
    expect(applyOperation(set, { type: "setStartDate", date: null }, ctx()).startDate).toBeNull();
  });

  it("is a no-op for the same date", () => {
    const set = applyOperation(fresh(), { type: "setStartDate", date: "2026-10-01" }, ctx(T1));
    expect(applyOperation(set, { type: "setStartDate", date: "2026-10-01" }, ctx(T2))).toBe(set);
  });
});

describe("applyOperations", () => {
  const batch: Operation[] = [
    { type: "setStartDate", date: "2026-10-01" },
    { type: "setTask", taskId: "d01-t1", done: true },
    { type: "setNotes", day: 1, notes: "Spend limit set" },
    { type: "setConfidence", day: 1, value: 4 },
  ];

  it("applies ops in order", () => {
    const next = applyOperations(
      fresh(),
      [...batch, { type: "setTask", taskId: "d01-t2", done: true }, { type: "setTask", taskId: "d01-t2", done: false }],
      ctx(),
    );
    expect(next.startDate).toBe("2026-10-01");
    expect(next.tasks).toEqual({
      "d01-t1": { done: true, completedAt: T1 },
      "d01-t2": { done: false, completedAt: null },
    });
    expect(next.days["1"]).toEqual({ notes: "Spend limit set", confidence: 4 });
  });

  it("is idempotent: replaying a batch returns the same document", () => {
    const once = applyOperations(fresh(), batch, ctx(T1));
    expect(applyOperations(once, batch, ctx(T2))).toBe(once);
  });

  it("never mutates its input", () => {
    const input = deepFreeze(applyOperations(fresh(), batch, ctx(T1)));
    const snapshot = JSON.stringify(input);
    const next = applyOperations(
      input,
      [
        { type: "setTask", taskId: "d01-t1", done: false },
        { type: "setNotes", day: 1, notes: "changed" },
        { type: "setStartDate", date: "2026-10-05" },
      ],
      ctx(T2),
    );
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(next).not.toBe(input);
  });

  it("produces documents that satisfy the progress schema", () => {
    const next = applyOperations(fresh(), [...batch, { type: "setTask", taskId: "d02-t1", done: true }], ctx());
    expect(ProgressSchema.safeParse(next).success).toBe(true);
  });
});

describe("describeOperations", () => {
  it("summarizes a batch for a commit message", () => {
    expect(describeOperations([{ type: "setTask", taskId: "d07-t3", done: true }])).toBe("progress: d07-t3 done");
    expect(
      describeOperations([
        { type: "setNotes", day: 7, notes: "a" },
        { type: "setNotes", day: 7, notes: "ab" },
        { type: "setConfidence", day: 7, value: null },
        { type: "setStartDate", date: "2026-10-01" },
        { type: "setTask", taskId: "d07-t1", done: false },
      ]),
    ).toBe("progress: day 7 notes, day 7 confidence cleared, start date 2026-10-01 and 1 more");
  });
});
