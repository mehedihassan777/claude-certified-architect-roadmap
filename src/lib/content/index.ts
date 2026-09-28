import sources from "@content/sources.json";
import week1 from "@content/week-1.json";
import week2 from "@content/week-2.json";
import week3 from "@content/week-3.json";
import week4 from "@content/week-4.json";
import week5 from "@content/week-5.json";
import week6 from "@content/week-6.json";
import type { Day, Week } from "./schema";
import { formatIssues, validateContent } from "./validate";

// Validated when the module loads, so invalid content fails `next build` and every test that imports it.
const result = validateContent({ weeks: [week1, week2, week3, week4, week5, week6], sources });
if (!result.ok) {
  throw new Error(`content/ failed validation (run npm run content:check):\n${formatIssues(result.issues)}`);
}

export const WEEKS: readonly Week[] = result.weeks;
export const DAYS: readonly Day[] = WEEKS.flatMap((week) => week.days);
export const TASK_IDS: ReadonlySet<string> = new Set(DAYS.flatMap((day) => day.tasks.map((task) => task.id)));
export const DAY_NUMBERS: ReadonlySet<number> = new Set(DAYS.map((day) => day.day));

export function getDay(day: number): Day | undefined {
  // The integrity rules guarantee DAYS[i] is day i + 1.
  return DAYS[day - 1];
}
