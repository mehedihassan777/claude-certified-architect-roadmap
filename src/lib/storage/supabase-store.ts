import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { emptyProgress, type Progress } from "@/lib/progress/schema";
import { parseStoredProgress } from "./codec";
import { StoreUnavailableError, VersionConflictError, type ProgressStore, type StoredProgress } from "./types";

export const PROGRESS_TABLE = "progress";

export interface ProgressRow {
  data: unknown;
  version: number;
}

/** The three queries the store needs, so tests can swap in memory rows for Supabase. */
export interface ProgressRows {
  get(userId: string): Promise<ProgressRow | null>;
  /** Inserts version 1 unless a row already exists (another request may have just created it). */
  insertIfMissing(userId: string, data: Progress): Promise<void>;
  /** Writes only if the row is still at `expectedVersion`; returns the new version, or null on a conflict. */
  update(userId: string, data: Progress, expectedVersion: number): Promise<number | null>;
}

/**
 * One user's progress: a row in `progress` holding the whole document as jsonb. The version is an
 * integer bumped on every write, and the update only matches the version that was read.
 */
export class SupabaseStore implements ProgressStore {
  constructor(
    private readonly rows: ProgressRows,
    private readonly userId: string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async read(): Promise<StoredProgress> {
    let row = await this.rows.get(this.userId);
    if (!row) {
      await this.rows.insertIfMissing(this.userId, emptyProgress(this.clock()));
      row = await this.rows.get(this.userId);
      if (!row) throw new StoreUnavailableError("Couldn't create your progress. Check the progress table's policies.");
    }
    const version = String(row.version);
    return { data: parseStoredProgress(row.data, version), version };
  }

  async write(data: Progress, expectedVersion: string): Promise<{ version: string }> {
    const expected = Number(expectedVersion);
    if (!Number.isSafeInteger(expected)) throw new VersionConflictError();
    const version = await this.rows.update(this.userId, data, expected);
    if (version === null) throw new VersionConflictError();
    return { version: String(version) };
  }
}

const RowSchema = z.object({ data: z.unknown(), version: z.coerce.number().int() });
const VersionSchema = z.array(z.object({ version: z.coerce.number().int() }));

function unavailable(error: PostgrestError): StoreUnavailableError {
  // 42P01: relation missing; PGRST205: table not in the schema cache.
  const missingTable = error.code === "42P01" || error.code === "PGRST205";
  return new StoreUnavailableError(
    missingTable
      ? "The progress table doesn't exist yet. Run supabase/migrations/0001_progress.sql in the Supabase SQL editor."
      : `Supabase refused the request: ${error.message}`,
  );
}

/** Queries run with the signed-in user's client, so row-level security limits them to their own row. */
export function supabaseProgressRows(client: SupabaseClient): ProgressRows {
  return {
    async get(userId) {
      const { data, error } = await client.from(PROGRESS_TABLE).select("data, version").eq("user_id", userId).maybeSingle();
      if (error) throw unavailable(error);
      return data === null ? null : RowSchema.parse(data);
    },
    async insertIfMissing(userId, data) {
      const { error } = await client
        .from(PROGRESS_TABLE)
        .upsert({ user_id: userId, data, version: 1 }, { onConflict: "user_id", ignoreDuplicates: true });
      if (error) throw unavailable(error);
    },
    async update(userId, data, expectedVersion) {
      const { data: rows, error } = await client
        .from(PROGRESS_TABLE)
        .update({ data, version: expectedVersion + 1, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("version", expectedVersion)
        .select("version");
      if (error) throw unavailable(error);
      const updated = VersionSchema.parse(rows);
      return updated[0]?.version ?? null;
    },
  };
}
