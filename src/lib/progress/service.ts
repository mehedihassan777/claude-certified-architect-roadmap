import { runExclusive } from "@/lib/storage/lock";
import {
  CorruptProgressError,
  VersionConflictError,
  type ProgressStore,
  type StoredProgress,
} from "@/lib/storage/types";
import { applyOperations, describeOperations } from "./apply";
import type { Operation, Progress } from "./schema";

export const MAX_CONFLICT_RETRIES = 3;

export interface ProgressDeps {
  store: ProgressStore;
  taskIds: ReadonlySet<string>;
  dayNumbers: ReadonlySet<number>;
  clock?: () => Date;
  /** Waits between conflict retries; tests pass one that doesn't sleep. */
  sleep?: (ms: number) => Promise<void>;
}

export interface ImportResult extends StoredProgress {
  /** Well-formed task IDs that aren't in the content. They're kept, not dropped. */
  orphans: string[];
}

// One read-apply-write cycle per store at a time in this process, so conflicts only come from
// other processes or devices.
const queues = new WeakMap<ProgressStore, Promise<unknown>>();

/** Read, apply every op, write. On a version conflict: re-read, re-apply, up to 3 retries. */
export function updateProgress(ops: readonly Operation[], deps: ProgressDeps): Promise<StoredProgress> {
  const clock = deps.clock ?? (() => new Date());
  return runExclusive(queues, deps.store, () =>
    withConflictRetry(deps, async () => {
      const current = await deps.store.read();
      const next = applyOperations(current.data, ops, {
        taskIds: deps.taskIds,
        dayNumbers: deps.dayNumbers,
        now: clock().toISOString(),
      });
      if (next === current.data) return current;
      const { version } = await deps.store.write(next, current.version, { message: describeOperations(ops) });
      return { data: next, version };
    }),
  );
}

/** Full replace (import, reset). This is also the only way to replace a corrupt stored file. */
export function replaceProgress(data: Progress, deps: ProgressDeps): Promise<ImportResult> {
  const clock = deps.clock ?? (() => new Date());
  const orphans = Object.keys(data.tasks)
    .filter((id) => !deps.taskIds.has(id))
    .sort();
  return runExclusive(queues, deps.store, () =>
    withConflictRetry(deps, async () => {
      const next: Progress = { ...data, updatedAt: clock().toISOString() };
      const { version } = await deps.store.write(next, await currentVersion(deps.store), {
        message: "progress: import",
      });
      return { data: next, version, orphans };
    }),
  );
}

async function withConflictRetry<T>(deps: ProgressDeps, attempt: () => Promise<T>): Promise<T> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let retry = 0; ; retry++) {
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof VersionConflictError) || retry >= MAX_CONFLICT_RETRIES) throw error;
      // Jittered backoff also gives GitHub a moment to serve the newest sha.
      await sleep(50 * 2 ** retry * (0.5 + Math.random()));
    }
  }
}

async function currentVersion(store: ProgressStore): Promise<string> {
  try {
    return (await store.read()).version;
  } catch (error) {
    if (error instanceof CorruptProgressError) return error.version;
    throw error;
  }
}
