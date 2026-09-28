import { describe, expect, it } from "vitest";
import { CorruptProgressError, VersionConflictError, type ProgressStore, type StoredProgress } from "@/lib/storage/types";
import { applyOperation } from "./apply";
import { emptyProgress, type Operation, type Progress } from "./schema";
import { MAX_CONFLICT_RETRIES, replaceProgress, updateProgress, type ProgressDeps } from "./service";

const TASK_IDS = new Set(Array.from({ length: 30 }, (_, index) => `d01-t${index + 1}`));
const DAY_NUMBERS = new Set([1]);
const NOW = "2026-10-01T09:00:00.000Z";

/** In-memory store with versions v1, v2, … that can simulate another device saving first. */
class MemoryStore implements ProgressStore {
  data: Progress = emptyProgress(new Date("2026-10-01T00:00:00.000Z"));
  version = 1;
  reads = 0;
  writes = 0;
  conflicts = 0;
  corrupt = false;
  beforeWrite: (() => void) | undefined;

  async read(): Promise<StoredProgress> {
    this.reads++;
    if (this.corrupt) throw new CorruptProgressError("stored file is corrupt", `v${this.version}`);
    return { data: this.data, version: `v${this.version}` };
  }

  async write(data: Progress, expectedVersion: string): Promise<{ version: string }> {
    this.beforeWrite?.();
    if (expectedVersion !== `v${this.version}`) {
      this.conflicts++;
      throw new VersionConflictError();
    }
    this.data = data;
    this.version++;
    this.writes++;
    this.corrupt = false;
    return { version: `v${this.version}` };
  }

  /** Another device commits a change directly. */
  externalTick(taskId: string): void {
    this.data = applyOperation(
      this.data,
      { type: "setTask", taskId, done: true },
      { taskIds: TASK_IDS, dayNumbers: DAY_NUMBERS, now: "2026-10-01T08:59:00.000Z" },
    );
    this.version++;
  }
}

function deps(store: ProgressStore): ProgressDeps {
  return { store, taskIds: TASK_IDS, dayNumbers: DAY_NUMBERS, clock: () => new Date(NOW), sleep: async () => {} };
}

function tick(taskId: string): Operation[] {
  return [{ type: "setTask", taskId, done: true }];
}

describe("updateProgress", () => {
  it("applies the ops and writes once", async () => {
    const store = new MemoryStore();
    const saved = await updateProgress(tick("d01-t1"), deps(store));
    expect(saved.data.tasks["d01-t1"]).toEqual({ done: true, completedAt: NOW });
    expect(saved.version).toBe("v2");
    expect(store.writes).toBe(1);
  });

  it("skips the write when nothing changes", async () => {
    const store = new MemoryStore();
    await updateProgress(tick("d01-t1"), deps(store));
    const again = await updateProgress(tick("d01-t1"), deps(store));
    expect(store.writes).toBe(1);
    expect(again.version).toBe("v2");
  });

  it("re-reads and re-applies after a conflict, keeping the other device's change", async () => {
    const store = new MemoryStore();
    let first = true;
    store.beforeWrite = () => {
      if (first) store.externalTick("d01-t2");
      first = false;
    };
    const saved = await updateProgress(tick("d01-t1"), deps(store));
    expect(saved.data.tasks["d01-t1"]?.done).toBe(true);
    expect(saved.data.tasks["d01-t2"]?.done).toBe(true);
    expect(store.conflicts).toBe(1);
    expect(store.reads).toBe(2);
  });

  it(`gives up after ${MAX_CONFLICT_RETRIES} retries`, async () => {
    const store = new MemoryStore();
    let n = 10;
    store.beforeWrite = () => store.externalTick(`d01-t${n++}`);
    await expect(updateProgress(tick("d01-t1"), deps(store))).rejects.toBeInstanceOf(VersionConflictError);
    expect(store.reads).toBe(MAX_CONFLICT_RETRIES + 1);
  });

  it("runs concurrent updates one after another, so none of them conflict", async () => {
    const store = new MemoryStore();
    await Promise.all([...TASK_IDS].map((taskId) => updateProgress(tick(taskId), deps(store))));
    expect(Object.keys(store.data.tasks)).toHaveLength(TASK_IDS.size);
    expect(store.conflicts).toBe(0);
  });

  it("refuses to apply ops to a corrupt document", async () => {
    const store = new MemoryStore();
    store.corrupt = true;
    await expect(updateProgress(tick("d01-t1"), deps(store))).rejects.toBeInstanceOf(CorruptProgressError);
    expect(store.writes).toBe(0);
  });
});

describe("replaceProgress", () => {
  it("replaces the document, stamps updatedAt and reports orphaned task IDs", async () => {
    const store = new MemoryStore();
    const imported: Progress = {
      ...emptyProgress(new Date("2026-01-01T00:00:00.000Z")),
      startDate: "2026-09-01",
      tasks: {
        "d01-t1": { done: true, completedAt: "2026-09-01T10:00:00.000Z" },
        "d05-t9": { done: true, completedAt: "2026-09-05T10:00:00.000Z" },
      },
    };
    const result = await replaceProgress(imported, deps(store));
    expect(result.orphans).toEqual(["d05-t9"]);
    expect(store.data).toEqual({ ...imported, updatedAt: NOW });
  });

  it("can replace a corrupt document", async () => {
    const store = new MemoryStore();
    store.corrupt = true;
    await replaceProgress(emptyProgress(new Date(NOW)), deps(store));
    expect(store.corrupt).toBe(false);
    expect(store.writes).toBe(1);
  });
});
