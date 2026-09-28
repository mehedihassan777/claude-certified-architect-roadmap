import type { Domain } from "@/lib/content/domains";
import type { ContentIndex, IndexedDay } from "@/lib/content/summary";
import { addDays, daysBetween, localDateKey } from "@/lib/dates";
import type { Progress } from "./schema";

export interface Fraction {
  done: number;
  total: number;
}

export type DayStatus = "done" | "in-progress" | "not-started";

export interface DayState {
  status: DayStatus;
  tasks: Fraction;
  minutes: Fraction;
}

export type Pace =
  | { kind: "unscheduled" }
  | { kind: "finished" }
  | { kind: "on-track" }
  | { kind: "behind"; days: number }
  | { kind: "ahead"; days: number };

export interface Stats {
  tasks: Fraction;
  minutes: Fraction;
  days: Fraction;
  byWeek: Array<{ week: number; title: string; tasks: Fraction; minutes: Fraction }>;
  byDomain: Array<{ domain: Domain; tasks: Fraction; minutes: Fraction }>;
  /** First day with an incomplete task; null once everything is done. */
  today: IndexedDay | null;
  /** The day the schedule expects today (1 on startDate), or null before the start or without one. */
  scheduledDay: number | null;
  /** Days until startDate when it lies in the future. */
  startsIn: number | null;
  pace: Pace;
  streak: { current: number; activeToday: boolean };
  /** Rated domains, weakest first, excluding exam-practice. */
  weakest: Array<{ domain: Domain; average: number; rated: number }>;
}

export function isTaskDone(progress: Progress, taskId: string): boolean {
  return progress.tasks[taskId]?.done ?? false;
}

export function dayState(day: IndexedDay, progress: Progress): DayState {
  const tasks: Fraction = { done: 0, total: day.tasks.length };
  const minutes: Fraction = { done: 0, total: day.estMinutes };
  for (const task of day.tasks) {
    if (isTaskDone(progress, task.id)) {
      tasks.done += 1;
      minutes.done += task.estMinutes;
    }
  }
  const status: DayStatus = tasks.done === 0 ? "not-started" : tasks.done === tasks.total ? "done" : "in-progress";
  return { status, tasks, minutes };
}

export function ratio({ done, total }: Fraction): number {
  return total === 0 ? 0 : done / total;
}

function add(target: Fraction, source: Fraction): void {
  target.done += source.done;
  target.total += source.total;
}

/**
 * Pure: `now` and `timeZone` come in as arguments, so "today", the streak and the pace are
 * computed for the viewer's local calendar and can be tested for any zone.
 */
export function computeStats(index: ContentIndex, progress: Progress, now: Date, timeZone: string): Stats {
  const todayKey = localDateKey(now, timeZone);
  const tasks: Fraction = { done: 0, total: 0 };
  const minutes: Fraction = { done: 0, total: 0 };
  const byWeek = new Map(index.weeks.map((w) => [w.week, { ...w, tasks: { done: 0, total: 0 }, minutes: { done: 0, total: 0 } }]));
  const byDomain = new Map<Domain, { domain: Domain; tasks: Fraction; minutes: Fraction }>();
  let daysDone = 0;
  let today: IndexedDay | null = null;

  for (const day of index.days) {
    const state = dayState(day, progress);
    add(tasks, state.tasks);
    add(minutes, state.minutes);
    const week = byWeek.get(day.week);
    if (week) {
      add(week.tasks, state.tasks);
      add(week.minutes, state.minutes);
    }
    let domain = byDomain.get(day.domain);
    if (!domain) {
      domain = { domain: day.domain, tasks: { done: 0, total: 0 }, minutes: { done: 0, total: 0 } };
      byDomain.set(day.domain, domain);
    }
    add(domain.tasks, state.tasks);
    add(domain.minutes, state.minutes);
    if (state.status === "done") daysDone += 1;
    else if (today === null) today = day;
  }

  const totalDays = index.days.length;
  const elapsed = progress.startDate === null ? null : daysBetween(progress.startDate, todayKey);

  return {
    tasks,
    minutes,
    days: { done: daysDone, total: totalDays },
    byWeek: [...byWeek.values()],
    byDomain: [...byDomain.values()],
    today,
    scheduledDay: elapsed === null || elapsed < 0 ? null : Math.min(elapsed + 1, totalDays),
    startsIn: elapsed !== null && elapsed < 0 ? -elapsed : null,
    pace: computePace(elapsed, daysDone, totalDays),
    streak: computeStreak(progress, todayKey, timeZone),
    weakest: computeWeakest(index, progress),
  };
}

/**
 * Day k is due by the end of startDate + (k − 1). N = whole days elapsed (capped at the plan
 * length), D = fully completed days. Finishing today's day reads "on track", not "ahead".
 */
export function computePace(elapsed: number | null, daysDone: number, totalDays: number): Pace {
  if (elapsed === null) return { kind: "unscheduled" };
  if (daysDone >= totalDays) return { kind: "finished" };
  const due = Math.min(Math.max(elapsed, 0), totalDays);
  if (daysDone < due) return { kind: "behind", days: due - daysDone };
  if (daysDone > due + 1) return { kind: "ahead", days: daysDone - due - 1 };
  return { kind: "on-track" };
}

/** Consecutive local dates with a completion, counted back from today, or from yesterday if today has none yet. */
export function computeStreak(progress: Progress, todayKey: string, timeZone: string): Stats["streak"] {
  const active = new Set<string>();
  for (const task of Object.values(progress.tasks)) {
    if (task.done && task.completedAt) active.add(localDateKey(task.completedAt, timeZone));
  }
  const activeToday = active.has(todayKey);
  let cursor = activeToday ? todayKey : addDays(todayKey, -1);
  let current = 0;
  while (active.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, activeToday };
}

export function computeWeakest(index: ContentIndex, progress: Progress): Stats["weakest"] {
  const sums = new Map<Domain, { total: number; rated: number }>();
  for (const day of index.days) {
    if (day.domain === "exam-practice") continue;
    const confidence = progress.days[String(day.day)]?.confidence;
    if (confidence == null) continue;
    const entry = sums.get(day.domain) ?? { total: 0, rated: 0 };
    entry.total += confidence;
    entry.rated += 1;
    sums.set(day.domain, entry);
  }
  return [...sums.entries()]
    .map(([domain, { total, rated }]) => ({ domain, average: total / rated, rated }))
    .sort((a, b) => a.average - b.average);
}
