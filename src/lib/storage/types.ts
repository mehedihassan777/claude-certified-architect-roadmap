import type { Progress } from "@/lib/progress/schema";

export interface StoredProgress {
  data: Progress;
  version: string;
}

export interface ProgressStore {
  /** The stored document and its version. An empty document is created if none exists yet. */
  read(): Promise<StoredProgress>;
  /** Replaces the document if it's still at `expectedVersion`; otherwise throws VersionConflictError. */
  write(data: Progress, expectedVersion: string): Promise<{ version: string }>;
}

/** The stored document changed after it was read. */
export class VersionConflictError extends Error {
  constructor(message = "Progress changed since it was read") {
    super(message);
    this.name = "VersionConflictError";
  }
}

/** The stored document isn't valid progress JSON. Operations never overwrite it; only an import can. */
export class CorruptProgressError extends Error {
  constructor(
    message: string,
    readonly version: string,
  ) {
    super(message);
    this.name = "CorruptProgressError";
  }
}

/** Storage failed or refused the request: a Supabase outage, a missing table or a bad key. */
export class StoreUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StoreUnavailableError";
  }
}
