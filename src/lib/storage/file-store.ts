import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { emptyProgress, ProgressSchema, type Progress } from "@/lib/progress/schema";
import { parseStoredProgress, serializeProgress, sha256 } from "./codec";
import { runExclusive } from "./lock";
import { StoreUnavailableError, VersionConflictError, type ProgressStore, type StoredProgress } from "./types";

// On globalThis so every copy of this module (dev reloads, separate route bundles) shares one lock per file.
const LOCKS_KEY = Symbol.for("cca-f-roadmap.file-locks");
const globalLocks = globalThis as unknown as Record<symbol, Map<string, Promise<unknown>> | undefined>;
const locks = (globalLocks[LOCKS_KEY] ??= new Map());

/**
 * Progress in a local JSON file. The version is the SHA-256 of the file's bytes. Reads and writes
 * take an in-process lock, and writes go to a temp file that is fsynced and renamed over the
 * original. Only one app instance should use a given file.
 */
export class FileStore implements ProgressStore {
  readonly filePath: string;
  private readonly clock: () => Date;

  constructor(filePath: string, clock: () => Date = () => new Date()) {
    this.filePath = path.resolve(filePath);
    this.clock = clock;
  }

  read(): Promise<StoredProgress> {
    return runExclusive(locks, this.filePath, async () => {
      const bytes = await this.readBytes();
      if (bytes === null) {
        const data = emptyProgress(this.clock());
        return { data, version: await this.writeBytes(serializeProgress(data)) };
      }
      const version = sha256(bytes);
      return { data: parseStoredProgress(bytes, this.filePath, version), version };
    });
  }

  async write(data: Progress, expectedVersion: string): Promise<{ version: string }> {
    const text = serializeProgress(ProgressSchema.parse(data));
    return runExclusive(locks, this.filePath, async () => {
      const bytes = await this.readBytes();
      if (bytes === null || sha256(bytes) !== expectedVersion) {
        throw new VersionConflictError(`${this.filePath} changed since it was read`);
      }
      return { version: await this.writeBytes(text) };
    });
  }

  private async readBytes(): Promise<Buffer | null> {
    try {
      return await readFile(this.filePath);
    } catch (error) {
      if (errorCode(error) === "ENOENT") return null;
      throw new StoreUnavailableError(`Cannot read ${this.filePath}: ${describe(error)}`, { cause: error });
    }
  }

  /** Writes atomically and returns the new version. */
  private async writeBytes(text: string): Promise<string> {
    const bytes = Buffer.from(text, "utf8");
    const dir = path.dirname(this.filePath);
    const temp = path.join(dir, `.${path.basename(this.filePath)}.${randomUUID()}.tmp`);
    try {
      await mkdir(dir, { recursive: true });
      const handle = await open(temp, "wx");
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await renameWithRetry(temp, this.filePath);
    } catch (error) {
      await rm(temp, { force: true }).catch(() => undefined);
      throw new StoreUnavailableError(`Cannot write ${this.filePath}: ${describe(error)}`, { cause: error });
    }
    await syncDirectory(dir);
    return sha256(bytes);
  }
}

async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      // Windows briefly locks a file that an antivirus scanner, the indexer or a reader has open.
      const transient = process.platform === "win32" && ["EPERM", "EACCES", "EBUSY"].includes(errorCode(error));
      if (!transient || attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * 2 ** attempt));
    }
  }
}

/** Makes the rename itself durable. Best effort; Windows can't fsync a directory. */
async function syncDirectory(dir: string): Promise<void> {
  if (process.platform === "win32") return;
  try {
    const handle = await open(dir, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // Some filesystems don't support fsync on directories.
  }
}

function errorCode(error: unknown): string {
  return (error as NodeJS.ErrnoException | undefined)?.code ?? "";
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
