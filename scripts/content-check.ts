import path from "node:path";
import { loadContentFromDisk } from "../src/lib/content/load";

async function main(): Promise<void> {
  const result = await loadContentFromDisk(path.join(process.cwd(), "content"));
  if (!result.ok) {
    console.error(`content check failed with ${result.issues.length} issue(s):`);
    for (const issue of result.issues) console.error(`  ${issue.where}: ${issue.message}`);
    process.exitCode = 1;
    return;
  }

  const days = result.weeks.flatMap((week) => week.days);
  const tasks = days.flatMap((day) => day.tasks).length;
  const questions = days.reduce((sum, day) => sum + day.selfCheck.length, 0);
  const minutes = days.reduce((sum, day) => sum + day.estMinutes, 0);
  console.log(
    `content OK: ${days.length} days, ${tasks} tasks, ${questions} self-check questions, ` +
      `${Math.round(minutes / 60)} hours, ${result.sources.sources.length} checked sources`,
  );
}

void main();
