import { describe, expect, it } from "vitest";
import { emptyProgress } from "@/lib/progress/schema";
import { MemoryRows } from "./memory-rows";
import { SupabaseStore } from "./supabase-store";
import { CorruptProgressError, VersionConflictError } from "./types";

const NOW = new Date("2026-10-01T09:00:00.000Z");

describe("SupabaseStore", () => {
  it("creates an empty document on first read, at version 1", async () => {
    const rows = new MemoryRows();
    const store = new SupabaseStore(rows, "alice", () => NOW);
    const { data, version } = await store.read();
    expect(data).toEqual(emptyProgress(NOW));
    expect(version).toBe("1");
    expect(rows.rows.size).toBe(1);
  });

  it("keeps each user's progress separate", async () => {
    const rows = new MemoryRows();
    const alice = new SupabaseStore(rows, "alice", () => NOW);
    const bob = new SupabaseStore(rows, "bob", () => NOW);
    const { version } = await alice.read();
    await alice.write({ ...emptyProgress(NOW), startDate: "2026-10-01" }, version);
    expect((await bob.read()).data.startDate).toBeNull();
    expect((await alice.read()).data.startDate).toBe("2026-10-01");
  });

  it("bumps the version on write and rejects a stale version", async () => {
    const store = new SupabaseStore(new MemoryRows(), "alice", () => NOW);
    const { data, version } = await store.read();
    expect(await store.write(data, version)).toEqual({ version: "2" });
    await expect(store.write(data, version)).rejects.toBeInstanceOf(VersionConflictError);
    await expect(store.write(data, "not-a-number")).rejects.toBeInstanceOf(VersionConflictError);
  });

  it("reports a stored document that fails validation, with its version", async () => {
    const rows = new MemoryRows();
    rows.rows.set("alice", { data: { schemaVersion: 2 }, version: 7 });
    const error = await new SupabaseStore(rows, "alice").read().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CorruptProgressError);
    expect((error as CorruptProgressError).version).toBe("7");
  });
});
