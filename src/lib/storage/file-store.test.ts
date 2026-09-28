import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emptyProgress, ProgressSchema } from "@/lib/progress/schema";
import { replaceProgress, updateProgress, type ProgressDeps } from "@/lib/progress/service";
import { sha256 } from "./codec";
import { FileStore } from "./file-store";
import { CorruptProgressError, VersionConflictError } from "./types";

const clock = () => new Date("2026-10-01T09:00:00.000Z");
const TASK_IDS = new Set(Array.from({ length: 50 }, (_, index) => `d01-t${index + 1}`));

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "cca-file-store-"));
  file = path.join(dir, "data", "progress.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function deps(store: FileStore): ProgressDeps {
  return { store, taskIds: TASK_IDS, dayNumbers: new Set([1]), clock, sleep: async () => {} };
}

describe("FileStore", () => {
  it("creates the file and its folder on first read", async () => {
    const { data, version } = await new FileStore(file, clock).read();
    expect(data).toEqual(emptyProgress(clock()));
    const bytes = await readFile(file);
    expect(version).toBe(sha256(bytes));
    expect(ProgressSchema.parse(JSON.parse(bytes.toString("utf8")))).toEqual(data);
  });

  it("returns the same version until the file changes", async () => {
    const store = new FileStore(file, clock);
    const first = await store.read();
    expect((await store.read()).version).toBe(first.version);
  });

  it("writes when the version matches and returns the new version", async () => {
    const store = new FileStore(file, clock);
    const { data, version } = await store.read();
    const next = { ...data, startDate: "2026-10-01" };
    const written = await store.write(next, version);
    expect(written.version).not.toBe(version);
    expect(await store.read()).toEqual({ data: next, version: written.version });
  });

  it("rejects a stale version and leaves the file untouched", async () => {
    const store = new FileStore(file, clock);
    const { data, version } = await store.read();
    await store.write({ ...data, startDate: "2026-10-01" }, version);
    const before = await readFile(file, "utf8");
    await expect(store.write({ ...data, startDate: "2026-12-24" }, version)).rejects.toBeInstanceOf(
      VersionConflictError,
    );
    expect(await readFile(file, "utf8")).toBe(before);
  });

  it("lets exactly one of several concurrent writes with the same version win", async () => {
    const store = new FileStore(file, clock);
    const { data, version } = await store.read();
    const dates = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"];
    const results = await Promise.allSettled(dates.map((date) => store.write({ ...data, startDate: date }, version)));

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of results) {
      if (result.status === "rejected") expect(result.reason).toBeInstanceOf(VersionConflictError);
    }
    // Writes queue on the lock in call order, so the first one wins.
    expect((await store.read()).data.startDate).toBe("2026-10-01");
  });

  it("keeps every one of 50 concurrent updates", async () => {
    const store = new FileStore(file, clock);
    await Promise.all(
      [...TASK_IDS].map((taskId) => updateProgress([{ type: "setTask", taskId, done: true }], deps(store))),
    );
    const { data } = await new FileStore(file, clock).read();
    expect(Object.keys(data.tasks)).toHaveLength(TASK_IDS.size);
    expect(Object.values(data.tasks).every((task) => task.done)).toBe(true);
  });

  it("leaves no temp files behind", async () => {
    const store = new FileStore(file, clock);
    await Promise.all(
      ["d01-t1", "d01-t2", "d01-t3"].map((taskId) => updateProgress([{ type: "setTask", taskId, done: true }], deps(store))),
    );
    expect(await readdir(path.dirname(file))).toEqual(["progress.json"]);
  });

  it("never overwrites a file that fails validation, but an import replaces it", async () => {
    await mkdir(path.dirname(file), { recursive: true });
    const broken = '{"schemaVersion": 1, "tasks": ';
    await writeFile(file, broken);
    const store = new FileStore(file, clock);

    await expect(store.read()).rejects.toBeInstanceOf(CorruptProgressError);
    await expect(updateProgress([{ type: "setTask", taskId: "d01-t1", done: true }], deps(store))).rejects.toBeInstanceOf(
      CorruptProgressError,
    );
    expect(await readFile(file, "utf8")).toBe(broken);

    const imported = await replaceProgress(emptyProgress(clock()), deps(store));
    expect(await store.read()).toEqual({ data: imported.data, version: imported.version });
  });

  it("reads a file saved with a UTF-8 byte order mark", async () => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `﻿${JSON.stringify(emptyProgress(clock()))}`);
    expect((await new FileStore(file, clock).read()).data).toEqual(emptyProgress(clock()));
  });

  it("writes stable JSON with tasks in day and number order", async () => {
    const store = new FileStore(file, clock);
    for (const taskId of ["d01-t10", "d01-t2", "d01-t1"]) {
      await updateProgress([{ type: "setTask", taskId, done: true }], deps(store));
    }
    const text = await readFile(file, "utf8");
    expect(Object.keys(JSON.parse(text).tasks)).toEqual(["d01-t1", "d01-t2", "d01-t10"]);
    expect(text.endsWith("}\n")).toBe(true);
  });
});
