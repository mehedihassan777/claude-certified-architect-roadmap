import { applyOperations, type ApplyContext } from "@/lib/progress/apply";
import type { Operation, Progress } from "@/lib/progress/schema";
import { errorMessage, fetchProgress, patchProgress, type Snapshot } from "./api-client";

export type SaveState = "idle" | "saving" | "saved" | "failed";

export interface SyncState {
  status: "loading" | "ready" | "error";
  loadError: string | null;
  server: Snapshot | null;
  /** Sent in the current PATCH. */
  inflight: readonly Operation[];
  /** Waiting for the current PATCH to finish; they go out together in the next one. */
  queued: readonly Operation[];
  /** Rolled back after a failed save; Retry sends them again. */
  failed: readonly Operation[];
  save: SaveState;
  saveError: string | null;
  /** The server snapshot with in-flight and queued ops applied: what the UI shows. */
  view: Progress | null;
}

export const INITIAL_SYNC_STATE: SyncState = {
  status: "loading",
  loadError: null,
  server: null,
  inflight: [],
  queued: [],
  failed: [],
  save: "idle",
  saveError: null,
  view: null,
};

/**
 * The browser's copy of progress. Optimistic: ops apply to the view at once through the same pure
 * applyOperation() the server runs. One PATCH is in flight at a time so order is preserved.
 */
export class ProgressSync {
  private state: SyncState = INITIAL_SYNC_STATE;
  private readonly listeners = new Set<() => void>();
  /** Bumped by every successful write, so a slower GET can't overwrite newer data. */
  private writeEpoch = 0;

  constructor(private readonly ids: Pick<ApplyContext, "taskIds" | "dayNumbers">) {}

  getState = (): SyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(patch: Partial<SyncState>): void {
    const next = { ...this.state, ...patch };
    next.view = next.server ? this.project(next.server.progress, [...next.inflight, ...next.queued]) : null;
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  private project(progress: Progress, ops: readonly Operation[]): Progress {
    try {
      return applyOperations(progress, ops, { ...this.ids, now: new Date().toISOString() });
    } catch {
      return progress;
    }
  }

  get busy(): boolean {
    return this.state.inflight.length > 0 || this.state.queued.length > 0;
  }

  dispatch(ops: readonly Operation[]): void {
    if (!this.state.server || ops.length === 0) return;
    this.update({ queued: [...this.state.queued, ...ops] });
    void this.flush();
  }

  retry(): void {
    if (this.state.failed.length === 0) return;
    this.update({ queued: [...this.state.failed, ...this.state.queued], failed: [], saveError: null });
    void this.flush();
  }

  /** Loads the latest snapshot unless local changes are pending. */
  async refresh(): Promise<void> {
    if (this.busy) return;
    const epoch = this.writeEpoch;
    try {
      const snapshot = await fetchProgress();
      if (epoch !== this.writeEpoch || this.busy) return;
      if (snapshot.version === this.state.server?.version && this.state.status === "ready") return;
      this.update({ server: snapshot, status: "ready", loadError: null });
    } catch (error) {
      if (this.state.status !== "ready") this.update({ status: "error", loadError: errorMessage(error) });
    }
  }

  /** After an import or reset: the server's new document replaces everything local. */
  replace(snapshot: Snapshot): void {
    this.writeEpoch += 1;
    this.update({ server: snapshot, status: "ready", loadError: null, failed: [], save: "saved", saveError: null });
  }

  /** On pagehide: send what's left with keepalive so it survives the page closing. */
  sendOnExit(extra: readonly Operation[] = []): void {
    const ops = [...this.state.queued, ...this.state.failed, ...extra];
    if (ops.length > 0) void patchProgress(ops, { keepalive: true }).catch(() => undefined);
  }

  private async flush(): Promise<void> {
    if (this.state.inflight.length > 0 || this.state.queued.length === 0) return;
    const ops = this.state.queued;
    this.update({ inflight: ops, queued: [], save: "saving" });
    try {
      const snapshot = await patchProgress(ops);
      this.writeEpoch += 1;
      this.update({ server: snapshot, inflight: [] });
    } catch (error) {
      // Roll back this batch and anything queued behind it, keeping them for Retry.
      this.update({
        inflight: [],
        queued: [],
        failed: [...this.state.failed, ...ops, ...this.state.queued],
        save: "failed",
        saveError: errorMessage(error),
      });
      return;
    }
    if (this.state.queued.length > 0) void this.flush();
    else this.update({ save: this.state.failed.length > 0 ? "failed" : "saved" });
  }
}
