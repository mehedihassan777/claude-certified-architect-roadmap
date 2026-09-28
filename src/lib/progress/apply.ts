import type { DayProgress, Operation, Progress } from "./schema";

export interface ApplyContext {
  /** Task IDs that exist in the content. */
  taskIds: ReadonlySet<string>;
  /** Day numbers that exist in the content. */
  dayNumbers: ReadonlySet<number>;
  /** UTC ISO timestamp recorded as completedAt / updatedAt. */
  now: string;
}

export class OperationError extends Error {
  constructor(
    message: string,
    readonly op: Operation,
  ) {
    super(message);
    this.name = "OperationError";
  }
}

const UNRATED_DAY: DayProgress = { notes: "", confidence: null };

/**
 * Pure and idempotent: operations set values and never toggle. When nothing changes, the same
 * object comes back, so callers can skip the write. The browser runs this same function for
 * optimistic updates.
 */
export function applyOperation(progress: Progress, op: Operation, ctx: ApplyContext): Progress {
  switch (op.type) {
    case "setTask": {
      if (!ctx.taskIds.has(op.taskId)) throw new OperationError(`Unknown task ${op.taskId}`, op);
      const current = progress.tasks[op.taskId];
      // Re-ticking a done task keeps its original completedAt.
      if (op.done === (current?.done ?? false)) return progress;
      const next = op.done ? { done: true, completedAt: ctx.now } : { done: false, completedAt: null };
      return { ...progress, tasks: { ...progress.tasks, [op.taskId]: next }, updatedAt: ctx.now };
    }
    case "setNotes":
      return updateDay(progress, op, ctx, (day) => ({ ...day, notes: op.notes }));
    case "setConfidence":
      return updateDay(progress, op, ctx, (day) => ({ ...day, confidence: op.value }));
    case "setStartDate":
      if (progress.startDate === op.date) return progress;
      return { ...progress, startDate: op.date, updatedAt: ctx.now };
  }
}

export function applyOperations(progress: Progress, ops: readonly Operation[], ctx: ApplyContext): Progress {
  return ops.reduce((current, op) => applyOperation(current, op, ctx), progress);
}

function updateDay(
  progress: Progress,
  op: Extract<Operation, { day: number }>,
  ctx: ApplyContext,
  change: (day: DayProgress) => DayProgress,
): Progress {
  if (!ctx.dayNumbers.has(op.day)) throw new OperationError(`Unknown day ${op.day}`, op);
  const key = String(op.day);
  const current = progress.days[key] ?? UNRATED_DAY;
  const next = change(current);
  if (next.notes === current.notes && next.confidence === current.confidence) return progress;
  return { ...progress, days: { ...progress.days, [key]: next }, updatedAt: ctx.now };
}
