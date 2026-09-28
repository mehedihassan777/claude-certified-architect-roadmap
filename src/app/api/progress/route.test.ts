import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProgress } from "@/lib/progress/schema";
import { GET as exportProgress } from "./export/route";
import { POST as importProgress } from "./import/route";
import { GET, PATCH } from "./route";

const BASE = "http://localhost:3000";
let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "cca-api-"));
  file = path.join(dir, "progress.json");
  vi.stubEnv("STORAGE_DRIVER", "file");
  vi.stubEnv("PROGRESS_FILE_PATH", file);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

function send(
  handler: (request: Request) => Promise<Response>,
  method: string,
  pathname: string,
  body?: unknown,
  headers: Record<string, string> = { origin: BASE },
): Promise<Response> {
  const init: RequestInit = { method, headers: { "content-type": "application/json", ...headers } };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  return handler(new Request(`${BASE}${pathname}`, init));
}

const getProgress = () => send(GET, "GET", "/api/progress");
const patchProgress = (body: unknown, headers?: Record<string, string>) =>
  send(PATCH, "PATCH", "/api/progress", body, headers);

describe("GET /api/progress", () => {
  it("returns an empty document and its version, uncached", async () => {
    const response = await getProgress();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.progress).toMatchObject({ schemaVersion: 1, startDate: null, tasks: {}, days: {} });
    expect(body.version).toEqual(expect.any(String));
  });
});

describe("PATCH /api/progress", () => {
  it("applies operations and persists them", async () => {
    const response = await patchProgress({
      ops: [
        { type: "setStartDate", date: "2026-10-01" },
        { type: "setTask", taskId: "d01-t1", done: true },
        { type: "setConfidence", day: 1, value: 4 },
      ],
    });
    expect(response.status).toBe(200);

    const { progress } = await (await getProgress()).json();
    expect(progress.startDate).toBe("2026-10-01");
    expect(progress.tasks["d01-t1"].done).toBe(true);
    expect(progress.days["1"]).toEqual({ notes: "", confidence: 4 });
  });

  it.each([
    ["malformed JSON", "{ not json", "Request body is not valid JSON"],
    ["an empty op list", { ops: [] }, "Request body is invalid"],
    ["an unknown op", { ops: [{ type: "toggleTask", taskId: "d01-t1" }] }, "Request body is invalid"],
    ["a confidence out of range", { ops: [{ type: "setConfidence", day: 1, value: 6 }] }, "Request body is invalid"],
    ["an impossible date", { ops: [{ type: "setStartDate", date: "2026-02-30" }] }, "Request body is invalid"],
  ])("rejects %s with 400", async (_, body, message) => {
    const response = await patchProgress(body);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(message);
  });

  it("rejects a well-formed task ID that isn't in the content with 422", async () => {
    const response = await patchProgress({ ops: [{ type: "setTask", taskId: "d01-t9", done: true }] });
    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("Unknown task d01-t9");
  });

  it("rejects a cross-origin request with 403", async () => {
    const response = await patchProgress(
      { ops: [{ type: "setTask", taskId: "d01-t1", done: true }] },
      { origin: "https://evil.example" },
    );
    expect(response.status).toBe(403);
  });

  it("accepts a request without Origin (non-browser clients)", async () => {
    const response = await patchProgress({ ops: [{ type: "setTask", taskId: "d01-t1", done: true }] }, {});
    expect(response.status).toBe(200);
  });
});

describe("GET /api/progress/export", () => {
  it("downloads the stored document", async () => {
    await patchProgress({ ops: [{ type: "setTask", taskId: "d01-t1", done: true }] });
    const response = await send(exportProgress, "GET", "/api/progress/export");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="cca-f-progress-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(JSON.parse(await response.text()).tasks["d01-t1"].done).toBe(true);
  });
});

describe("POST /api/progress/import", () => {
  it("replaces the document and reports task IDs that aren't in the content", async () => {
    const imported = {
      ...emptyProgress(new Date("2026-09-01T00:00:00.000Z")),
      startDate: "2026-09-01",
      tasks: {
        "d01-t1": { done: true, completedAt: "2026-09-01T10:00:00.000Z" },
        "d01-t9": { done: true, completedAt: "2026-09-01T11:00:00.000Z" },
      },
    };
    const response = await send(importProgress, "POST", "/api/progress/import", imported);
    expect(response.status).toBe(200);
    expect((await response.json()).orphans).toEqual(["d01-t9"]);

    const { progress } = await (await getProgress()).json();
    expect(progress.startDate).toBe("2026-09-01");
    expect(Object.keys(progress.tasks)).toEqual(["d01-t1", "d01-t9"]);
  });

  it("rejects a document that doesn't match the schema", async () => {
    const response = await send(importProgress, "POST", "/api/progress/import", { schemaVersion: 2, tasks: {} });
    expect(response.status).toBe(400);
    expect((await response.json()).details).toEqual(expect.any(String));
  });

  it("is the way to recover from a corrupt file", async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(file, "{ corrupted");

    const broken = await getProgress();
    expect(broken.status).toBe(500);
    expect((await broken.json()).error).toContain("Fix the file or import a backup");

    const patched = await patchProgress({ ops: [{ type: "setTask", taskId: "d01-t1", done: true }] });
    expect(patched.status).toBe(500);
    expect(await readFile(file, "utf8")).toBe("{ corrupted");

    const imported = await send(importProgress, "POST", "/api/progress/import", emptyProgress(new Date()));
    expect(imported.status).toBe(200);
    expect((await getProgress()).status).toBe(200);
  });
});

describe("configuration errors", () => {
  it("answers 503 with the reason when STORAGE_DRIVER is invalid", async () => {
    vi.stubEnv("STORAGE_DRIVER", "s3");
    const response = await getProgress();
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain('STORAGE_DRIVER must be "file" or "github"');
  });
});
