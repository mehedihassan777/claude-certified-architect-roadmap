import { z } from "zod";
import { DOMAINS, TASK_STATEMENT_IDS } from "./domains";
import { DAYS_PER_WEEK, TOTAL_DAYS, TOTAL_WEEKS } from "./rules";

export const TASK_TYPES = ["recall", "study", "hands-on", "practice", "revise", "quiz"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const DayNumberSchema = z.number().int().min(1).max(TOTAL_DAYS);

/** `dNN-tM`, e.g. d07-t3: NN is the day (01–42) and M counts up from 1. */
export const TaskIdSchema = z
  .string()
  .regex(/^d(0[1-9]|[1-3]\d|4[0-2])-t[1-9]\d*$/, "expected a task ID like d07-t3");

const Text = z.string().regex(/\S/, "must not be blank");
const HttpsUrl = z.url({ protocol: /^https$/, hostname: z.regexes.domain });

export const ResourceSchema = z.strictObject({
  title: Text,
  url: HttpsUrl,
});

export const TaskSchema = z.strictObject({
  id: TaskIdSchema,
  type: z.enum(TASK_TYPES),
  title: Text,
  details: Text,
  estMinutes: z.number().int().min(5).max(180),
  resources: z.array(ResourceSchema),
});

const OptionIndex = z.number().int().min(0).max(3);

export const SelfCheckSchema = z.strictObject({
  question: Text,
  options: z.array(Text).length(4),
  /** One index for a single-answer item, or 2–3 distinct indexes for a "select N" item. */
  answerIndex: z.union([
    OptionIndex,
    z
      .array(OptionIndex)
      .min(2)
      .max(3)
      .refine((indexes) => new Set(indexes).size === indexes.length, "answer indexes must be distinct"),
  ]),
  explanation: Text,
});

export const DaySchema = z.strictObject({
  day: DayNumberSchema,
  week: z.number().int().min(1).max(TOTAL_WEEKS),
  title: Text,
  domain: z.enum(DOMAINS),
  estMinutes: z.number().int().positive(),
  objectives: z.array(Text).min(1),
  keyPoints: z.array(Text).min(4).max(6),
  connectToExperience: Text.optional(),
  taskStatements: z.array(z.enum(TASK_STATEMENT_IDS)).min(1).optional(),
  tasks: z.array(TaskSchema).min(3).max(5),
  selfCheck: z.array(SelfCheckSchema).min(3).max(10),
});

export const WeekSchema = z.strictObject({
  week: z.number().int().min(1).max(TOTAL_WEEKS),
  title: Text,
  days: z.array(DaySchema).length(DAYS_PER_WEEK),
});

export const PUBLISHERS = ["anthropic", "mcp", "community", "other"] as const;

/** One page that was opened and checked; every resource URL must match one of these. */
export const SourceSchema = z.strictObject({
  url: HttpsUrl,
  title: Text,
  publisher: z.enum(PUBLISHERS),
  checkedOn: z.iso.date(),
});

export const SourcesFileSchema = z.strictObject({
  sources: z.array(SourceSchema),
});

export type Resource = z.infer<typeof ResourceSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type SelfCheck = z.infer<typeof SelfCheckSchema>;
export type Day = z.infer<typeof DaySchema>;
export type Week = z.infer<typeof WeekSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type SourcesFile = z.infer<typeof SourcesFileSchema>;
