import { TASK_STATEMENT_IDS, type TaskStatementId } from "./domains";
import {
  COMMUNITY_LABEL,
  DAYS_PER_WEEK,
  isReviewDay,
  MIN_MULTI_RESPONSE_PER_REVIEW_DAY,
  RECALL_MINUTES,
  SELF_CHECKS_PER_DAY,
  SELF_CHECKS_PER_REVIEW_DAY,
  TOTAL_DAYS,
  TOTAL_WEEKS,
} from "./rules";
import type { Day, Source, SourcesFile, Week } from "./schema";

export interface ContentIssue {
  where: string;
  message: string;
}

type Report = (where: string, message: string) => void;

/** Registry lookup key: the fragment is dropped, so a link to a section of an opened page matches that page. */
export function sourceKey(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
}

/**
 * Cross-file rules the Zod schema can't express. `weeks[i]` must be the parsed `week-(i + 1).json`.
 */
export function checkIntegrity(weeks: readonly Week[], sources: SourcesFile): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const report: Report = (where, message) => issues.push({ where, message });

  const registry = new Map<string, Source>();
  for (const source of sources.sources) {
    const key = sourceKey(source.url);
    if (registry.has(key)) report("sources.json", `${source.url} is listed more than once`);
    registry.set(key, source);
  }

  if (weeks.length !== TOTAL_WEEKS) {
    report("content", `expected ${TOTAL_WEEKS} week files, found ${weeks.length}`);
  }

  const seenDays = new Set<number>();
  const taskOwners = new Map<string, number>();
  const covered = new Set<TaskStatementId>();

  weeks.forEach((week, index) => {
    const weekNumber = index + 1;
    const file = `week-${weekNumber}.json`;
    if (week.week !== weekNumber) report(file, `"week" is ${week.week}; expected ${weekNumber}`);

    week.days.forEach((day, position) => {
      const expectedDay = (weekNumber - 1) * DAYS_PER_WEEK + position + 1;
      const where = `${file}, day ${day.day}`;
      if (day.day !== expectedDay) report(where, `expected day ${expectedDay} at position ${position + 1}`);
      if (day.week !== weekNumber) report(where, `"week" is ${day.week}; expected ${weekNumber}`);
      if (seenDays.has(day.day)) report(where, "this day appears more than once");
      seenDays.add(day.day);

      checkTasks(day, where, taskOwners, registry, report);
      checkSelfChecks(day, where, report);

      const statements = day.taskStatements ?? [];
      if (new Set(statements).size !== statements.length) report(where, "taskStatements lists an ID twice");
      for (const id of statements) covered.add(id);
    });
  });

  for (let day = 1; day <= TOTAL_DAYS; day++) {
    if (!seenDays.has(day)) report("content", `day ${day} is missing`);
  }
  for (const id of TASK_STATEMENT_IDS) {
    if (!covered.has(id)) report("content", `task statement ${id} is not covered by any day`);
  }
  return issues;
}

function checkTasks(
  day: Day,
  where: string,
  taskOwners: Map<string, number>,
  registry: ReadonlyMap<string, Source>,
  report: Report,
): void {
  const prefix = `d${String(day.day).padStart(2, "0")}-`;
  for (const task of day.tasks) {
    const owner = taskOwners.get(task.id);
    if (owner === undefined) taskOwners.set(task.id, day.day);
    else report(where, `task ID ${task.id} is already used on day ${owner}`);
    if (!task.id.startsWith(prefix)) report(where, `task ID ${task.id} should start with ${prefix}`);

    const linked = new Set<string>();
    for (const resource of task.resources) {
      const key = sourceKey(resource.url);
      if (linked.has(key)) report(where, `${task.id} links ${resource.url} twice`);
      linked.add(key);

      const source = registry.get(key);
      if (!source) {
        report(where, `${task.id} links ${resource.url}, which isn't listed in sources.json`);
      } else if (source.publisher === "community" && !resource.title.endsWith(COMMUNITY_LABEL)) {
        report(where, `${task.id}: the title for ${resource.url} must end with "${COMMUNITY_LABEL}"`);
      }
    }
  }

  const minutes = day.tasks.reduce((sum, task) => sum + task.estMinutes, 0);
  if (minutes !== day.estMinutes) {
    report(where, `estMinutes is ${day.estMinutes}, but its tasks add up to ${minutes}`);
  }

  const first = day.tasks[0];
  const last = day.tasks[day.tasks.length - 1];
  if (day.day > 1 && (first?.type !== "recall" || first.estMinutes !== RECALL_MINUTES)) {
    report(where, `the first task must be a ${RECALL_MINUTES}-minute recall task`);
  }
  if (last?.type !== "quiz") report(where, "the last task must be a quiz task");
}

function checkSelfChecks(day: Day, where: string, report: Report): void {
  const count = day.selfCheck.length;
  if (isReviewDay(day.day)) {
    if (count !== SELF_CHECKS_PER_REVIEW_DAY) {
      report(where, `a review day needs exactly ${SELF_CHECKS_PER_REVIEW_DAY} self-check questions; found ${count}`);
    }
    const multiResponse = day.selfCheck.filter((item) => Array.isArray(item.answerIndex)).length;
    if (multiResponse < MIN_MULTI_RESPONSE_PER_REVIEW_DAY) {
      report(where, `a review day needs at least ${MIN_MULTI_RESPONSE_PER_REVIEW_DAY} multi-response questions; found ${multiResponse}`);
    }
  } else if (count < SELF_CHECKS_PER_DAY.min || count > SELF_CHECKS_PER_DAY.max) {
    report(where, `expected ${SELF_CHECKS_PER_DAY.min}–${SELF_CHECKS_PER_DAY.max} self-check questions; found ${count}`);
  }

  day.selfCheck.forEach((item, index) => {
    const options = item.options.map((option) => option.trim().toLowerCase());
    if (new Set(options).size !== options.length) report(where, `self-check ${index + 1} has duplicate options`);
  });
}
