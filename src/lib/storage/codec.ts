import { createHash } from "node:crypto";
import { z } from "zod";
import { ProgressSchema, type Progress } from "@/lib/progress/schema";
import { CorruptProgressError } from "./types";

/** Stable, readable JSON: fixed key order, tasks sorted by day then number, trailing newline. */
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

/** Parses stored bytes (a UTF-8 BOM is fine) or throws CorruptProgressError carrying the version. */
export function parseStoredProgress(bytes: Uint8Array, where: string, version: string): Progress {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new CorruptProgressError(
      `${where} is not valid JSON (${error instanceof Error ? error.message : String(error)}). Fix the file or import a backup.`,
      version,
    );
  }
  const result = ProgressSchema.safeParse(json);
  if (!result.success) {
    throw new CorruptProgressError(
      `${where} doesn't match the progress schema. Fix the file or import a backup.\n${z.prettifyError(result.error)}`,
      version,
    );
  }
  return result.data;
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareTaskIds(a: string, b: string): number {
  const [dayA = 0, taskA = 0] = a.match(/\d+/g)?.map(Number) ?? [];
  const [dayB = 0, taskB = 0] = b.match(/\d+/g)?.map(Number) ?? [];
  return dayA - dayB || taskA - taskB || a.localeCompare(b);
}
