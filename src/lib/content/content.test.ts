import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { DAYS, getDay, TASK_IDS, WEEKS } from "./index";
import { checkIntegrity } from "./integrity";
import { loadContentFromDisk } from "./load";
import { COMMUNITY_LABEL } from "./rules";
import { ResourceSchema, SelfCheckSchema, type SourcesFile, type Week } from "./schema";
import { formatIssues } from "./validate";

const CONTENT_DIR = path.join(process.cwd(), "content");

describe("content/", () => {
  it("passes the schema and integrity checks", async () => {
    const result = await loadContentFromDisk(CONTENT_DIR);
    if (!result.ok) throw new Error(`content check failed:\n${formatIssues(result.issues)}`);
    expect(result.weeks).toHaveLength(6);
  });

  it("loads in the app with days 1–42 in order and unique task IDs", () => {
    expect(WEEKS).toHaveLength(6);
    expect(DAYS.map((day) => day.day)).toEqual(Array.from({ length: 42 }, (_, index) => index + 1));
    expect(TASK_IDS.size).toBe(DAYS.reduce((count, day) => count + day.tasks.length, 0));
    expect(getDay(7)?.day).toBe(7);
    expect(getDay(43)).toBeUndefined();
  });
});

describe("integrity rules", () => {
  let base: { weeks: Week[]; sources: SourcesFile };

  beforeAll(async () => {
    const result = await loadContentFromDisk(CONTENT_DIR);
    if (!result.ok) throw new Error(formatIssues(result.issues));
    base = { weeks: result.weeks, sources: result.sources };
  });

  /** Checks a modified copy of the real content and returns the messages. */
  function issuesAfter(change: (content: { weeks: Week[]; sources: SourcesFile }) => void): string[] {
    const copy = structuredClone(base);
    change(copy);
    return checkIntegrity(copy.weeks, copy.sources).map((issue) => issue.message);
  }

  const day = (content: { weeks: Week[] }, n: number) => {
    const found = content.weeks[Math.ceil(n / 7) - 1]?.days[(n - 1) % 7];
    if (!found) throw new Error(`no day ${n}`);
    return found;
  };

  it("accepts the content unchanged", () => {
    expect(issuesAfter(() => {})).toEqual([]);
  });

  it("flags a task ID used twice", () => {
    const issues = issuesAfter((content) => {
      const tasks = day(content, 2).tasks;
      tasks[1]!.id = tasks[2]!.id;
    });
    expect(issues).toContainEqual(expect.stringMatching(/^task ID d02-t3 is already used on day 2$/));
  });

  it("flags a task ID that belongs to another day", () => {
    const issues = issuesAfter((content) => {
      day(content, 3).tasks[1]!.id = "d04-t9";
    });
    expect(issues).toContain("task ID d04-t9 should start with d03-");
  });

  it("flags a missing or repeated day", () => {
    const issues = issuesAfter((content) => {
      content.weeks[5]!.days[6] = structuredClone(day(content, 41));
    });
    expect(issues).toEqual(
      expect.arrayContaining(["expected day 42 at position 7", "this day appears more than once", "day 42 is missing"]),
    );
  });

  it("flags estMinutes that don't match the tasks", () => {
    const issues = issuesAfter((content) => {
      day(content, 5).estMinutes += 5;
    });
    expect(issues).toContainEqual(expect.stringContaining("but its tasks add up to"));
  });

  it("requires a 10-minute recall task first (from Day 2) and a quiz task last", () => {
    const issues = issuesAfter((content) => {
      day(content, 2).tasks[0]!.type = "study";
      day(content, 3).tasks.at(-1)!.type = "practice";
    });
    expect(issues).toEqual(
      expect.arrayContaining(["the first task must be a 10-minute recall task", "the last task must be a quiz task"]),
    );
  });

  it("requires 10 questions, including 2 multi-response, on review days", () => {
    const issues = issuesAfter((content) => {
      const review = day(content, 14);
      review.selfCheck.pop();
      for (const item of review.selfCheck) item.answerIndex = 0;
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        "a review day needs exactly 10 self-check questions; found 9",
        "a review day needs at least 2 multi-response questions; found 0",
      ]),
    );
  });

  it("requires 3–5 questions on other days", () => {
    const issues = issuesAfter((content) => {
      day(content, 9).selfCheck.splice(1);
    });
    expect(issues).toContain("expected 3–5 self-check questions; found 1");
  });

  it("flags duplicate options", () => {
    const issues = issuesAfter((content) => {
      const options = day(content, 10).selfCheck[0]!.options;
      options[1] = ` ${options[0]!.toUpperCase()} `;
    });
    expect(issues).toContain("self-check 1 has duplicate options");
  });

  it("only allows URLs listed in sources.json, with or without a #fragment", () => {
    const registered = base.sources.sources.find((source) => source.publisher === "anthropic")!;
    const issues = issuesAfter((content) => {
      day(content, 8).tasks[1]!.resources = [
        { title: "Listed page, one section", url: `${registered.url}#section` },
        { title: "Never opened", url: "https://example.com/not-opened" },
      ];
    });
    expect(issues).toEqual([
      "d08-t2 links https://example.com/not-opened, which isn't listed in sources.json",
    ]);
  });

  it("requires the community label on community links", () => {
    const community = base.sources.sources.find((source) => source.publisher === "community")!;
    const issues = issuesAfter((content) => {
      day(content, 8).tasks[1]!.resources = [{ title: "Mock exam", url: community.url }];
    });
    expect(issues).toEqual([`d08-t2: the title for ${community.url} must end with "${COMMUNITY_LABEL}"`]);
  });

  it("requires every exam task statement to be covered", () => {
    const issues = issuesAfter((content) => {
      day(content, 32).taskStatements = undefined;
    });
    expect(issues).toEqual(["task statement 1.5 is not covered by any day"]);
  });
});

describe("schema", () => {
  it("only accepts https links to real hostnames", () => {
    expect(ResourceSchema.safeParse({ title: "Docs", url: "https://platform.claude.com/docs/en/intro" }).success).toBe(true);
    expect(ResourceSchema.safeParse({ title: "Docs", url: "http://platform.claude.com/docs" }).success).toBe(false);
    expect(ResourceSchema.safeParse({ title: "Local", url: "https://localhost/x" }).success).toBe(false);
  });

  it("accepts one answer or 2–3 distinct answers", () => {
    const item = { question: "Q?", options: ["A", "B", "C", "D"], explanation: "Because." };
    expect(SelfCheckSchema.safeParse({ ...item, answerIndex: 2 }).success).toBe(true);
    expect(SelfCheckSchema.safeParse({ ...item, answerIndex: [0, 3] }).success).toBe(true);
    expect(SelfCheckSchema.safeParse({ ...item, answerIndex: [1, 1] }).success).toBe(false);
    expect(SelfCheckSchema.safeParse({ ...item, answerIndex: [0, 1, 2, 3] }).success).toBe(false);
    expect(SelfCheckSchema.safeParse({ ...item, answerIndex: 4 }).success).toBe(false);
    expect(SelfCheckSchema.safeParse({ ...item, options: ["A", "B", "C", "D", "E"], answerIndex: 0 }).success).toBe(false);
  });
});
