import type { ZodError } from "zod";
import { checkIntegrity, type ContentIssue } from "./integrity";
import { SourcesFileSchema, WeekSchema, type SourcesFile, type Week } from "./schema";

export interface RawContent {
  /** Parsed JSON of week-1.json … week-6.json, in order. */
  weeks: readonly unknown[];
  sources: unknown;
}

export type ContentResult =
  | { ok: true; weeks: Week[]; sources: SourcesFile }
  | { ok: false; issues: ContentIssue[] };

/** Schema first; the cross-file integrity rules only run once every file parses. */
export function validateContent(raw: RawContent): ContentResult {
  const issues: ContentIssue[] = [];
  const weeks: Week[] = [];

  raw.weeks.forEach((data, index) => {
    const result = WeekSchema.safeParse(data);
    if (result.success) weeks.push(result.data);
    else issues.push(...zodIssues(`week-${index + 1}.json`, result.error));
  });

  const sources = SourcesFileSchema.safeParse(raw.sources);
  if (!sources.success) issues.push(...zodIssues("sources.json", sources.error));
  if (issues.length > 0 || !sources.success) return { ok: false, issues };

  const integrity = checkIntegrity(weeks, sources.data);
  return integrity.length > 0 ? { ok: false, issues: integrity } : { ok: true, weeks, sources: sources.data };
}

export function formatIssues(issues: readonly ContentIssue[]): string {
  return issues.map((issue) => `- ${issue.where}: ${issue.message}`).join("\n");
}

function zodIssues(file: string, error: ZodError): ContentIssue[] {
  return error.issues.map((issue) => ({ where: file + formatPath(issue.path), message: issue.message }));
}

function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return "";
  const segments = path.map((key, index) =>
    typeof key === "number" ? `[${key}]` : `${index === 0 ? "" : "."}${String(key)}`,
  );
  return ` at ${segments.join("")}`;
}
