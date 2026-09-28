import type { Progress } from "@/lib/progress/schema";
import type { ProgressRow, ProgressRows } from "./supabase-store";

/** In-memory stand-in for the Supabase progress table, used by the tests. */
export class MemoryRows implements ProgressRows {
  readonly rows = new Map<string, ProgressRow>();
  /** Runs before each update, e.g. to simulate another device saving first. */
  beforeUpdate: ((userId: string) => void) | undefined;

  async get(userId: string): Promise<ProgressRow | null> {
    const row = this.rows.get(userId);
    return row ? structuredClone(row) : null;
  }

  async insertIfMissing(userId: string, data: Progress): Promise<void> {
    if (!this.rows.has(userId)) this.rows.set(userId, { data: structuredClone(data), version: 1 });
  }

  async update(userId: string, data: Progress, expectedVersion: number): Promise<number | null> {
    this.beforeUpdate?.(userId);
    const row = this.rows.get(userId);
    if (!row || row.version !== expectedVersion) return null;
    this.rows.set(userId, { data: structuredClone(data), version: expectedVersion + 1 });
    return expectedVersion + 1;
  }
}
