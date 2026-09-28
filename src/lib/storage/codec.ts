import { z } from "zod";
import { ProgressSchema, type Progress } from "@/lib/progress/schema";
import { CorruptProgressError } from "./types";

/** Stable, readable JSON for export: fixed key order, tasks sorted by day then number, trailing newline. */
export function serializeProgress(data: Progress): string {
  const ordered = {
    schemaVersion: data.schemaVersion,
    startDate: data.startDate,
    updatedAt: data.updatedAt,
    tasks: Object.fromEntries(
      Object.entries(data.tasks)
        .sort(([a], [b]) => compareTaskIds(a, b))
        .map(([id, task]) => [id, { done: task.done, completedAt: task.completedAt }]),
    ),
    // Integer-like keys ("1" … "42") always serialize in numeric order.
    days: Object.fromEntries(
      Object.entries(data.days).map(([day, entry]) => [day, { notes: entry.notes, confidence: entry.confidence }]),
    ),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/** Validates a stored document or throws CorruptProgressError carrying its version. */
export function parseStoredProgress(json: unknown, version: string): Progress {
  const result = ProgressSchema.safeParse(json);
  if (!result.success) {
    throw new CorruptProgressError(
      `Your saved progress doesn't match the progress schema. Import a backup to replace it.\n${z.prettifyError(result.error)}`,
      version,
    );
  }
  return result.data;
}

function compareTaskIds(a: string, b: string): number {
  const [dayA = 0, taskA = 0] = a.match(/\d+/g)?.map(Number) ?? [];
  const [dayB = 0, taskB = 0] = b.match(/\d+/g)?.map(Number) ?? [];
  return dayA - dayB || taskA - taskB || a.localeCompare(b);
}
