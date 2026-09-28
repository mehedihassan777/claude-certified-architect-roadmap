import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ContentIssue } from "./integrity";
import { TOTAL_WEEKS } from "./rules";
import { validateContent, type ContentResult } from "./validate";

const WEEK_FILES = Array.from({ length: TOTAL_WEEKS }, (_, index) => `week-${index + 1}.json`);
const EXPECTED_FILES = new Set([...WEEK_FILES, "sources.json"]);

/** Reads content/ from disk (for `npm run content:check` and the tests) and validates it. */
export async function loadContentFromDisk(dir: string): Promise<ContentResult> {
  const issues: ContentIssue[] = [];

  for (const name of await readdir(dir)) {
    if (name.endsWith(".json") && !EXPECTED_FILES.has(name)) {
      issues.push({ where: name, message: "unexpected file: content/ holds week-1.json … week-6.json and sources.json" });
    }
  }

  const read = async (name: string): Promise<unknown> => {
    try {
      return JSON.parse(await readFile(path.join(dir, name), "utf8"));
    } catch (error) {
      const reason = error instanceof SyntaxError ? `invalid JSON: ${error.message}` : `cannot read: ${String(error)}`;
      issues.push({ where: name, message: reason });
      return undefined;
    }
  };

  const weeks = await Promise.all(WEEK_FILES.map(read));
  const sources = await read("sources.json");
  if (issues.length > 0) return { ok: false, issues };
  return validateContent({ weeks, sources });
}
