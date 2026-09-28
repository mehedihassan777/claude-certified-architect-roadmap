import { z } from "zod";
import { DayNumberSchema, TaskIdSchema } from "@/lib/content/schema";

export const NOTES_MAX_LENGTH = 20_000;
export const MAX_OPS_PER_REQUEST = 50;

/** A calendar date with no time zone, e.g. "2026-10-01". */
export const IsoDateSchema = z.iso.date();
/** A UTC timestamp ending in Z; offsets are rejected. */
export const UtcTimestampSchema = z.iso.datetime();
export const ConfidenceSchema = z.number().int().min(1).max(5);

export const TaskProgressSchema = z
  .strictObject({
    done: z.boolean(),
    completedAt: UtcTimestampSchema.nullable(),
  })
  .refine((task) => task.done === (task.completedAt !== null), {
    message: "completedAt must be set exactly when done is true",
  });

export const DayProgressSchema = z.strictObject({
  notes: z.string().max(NOTES_MAX_LENGTH),
  /** null until the day is rated. */
  confidence: ConfidenceSchema.nullable(),
});

export const DayKeySchema = z.string().regex(/^([1-9]|[1-3]\d|4[0-2])$/, "expected a day number from 1 to 42");

export const ProgressSchema = z.strictObject({
  schemaVersion: z.literal(1),
  startDate: IsoDateSchema.nullable(),
  updatedAt: UtcTimestampSchema,
  tasks: z.record(TaskIdSchema, TaskProgressSchema),
  days: z.record(DayKeySchema, DayProgressSchema),
});

export const OperationSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("setTask"), taskId: TaskIdSchema, done: z.boolean() }),
  z.strictObject({ type: z.literal("setNotes"), day: DayNumberSchema, notes: z.string().max(NOTES_MAX_LENGTH) }),
  z.strictObject({ type: z.literal("setConfidence"), day: DayNumberSchema, value: ConfidenceSchema.nullable() }),
  z.strictObject({ type: z.literal("setStartDate"), date: IsoDateSchema.nullable() }),
]);

export const PatchBodySchema = z.strictObject({
  ops: z.array(OperationSchema).min(1).max(MAX_OPS_PER_REQUEST),
});

export type TaskProgress = z.infer<typeof TaskProgressSchema>;
export type DayProgress = z.infer<typeof DayProgressSchema>;
export type Progress = z.infer<typeof ProgressSchema>;
export type Operation = z.infer<typeof OperationSchema>;

export function emptyProgress(now: Date): Progress {
  return { schemaVersion: 1, startDate: null, updatedAt: now.toISOString(), tasks: {}, days: {} };
}
