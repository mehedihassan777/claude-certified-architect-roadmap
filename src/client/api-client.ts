import { z } from "zod";
import { ProgressSchema, type Operation, type Progress } from "@/lib/progress/schema";

export interface Snapshot {
  progress: Progress;
  version: string;
}

const SnapshotSchema = z.object({ progress: ProgressSchema, version: z.string() });
const ImportResultSchema = SnapshotSchema.extend({ orphans: z.array(z.string()) });
const ErrorSchema = z.object({ error: z.string(), details: z.string().optional() });

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ErrorSchema.safeParse(body);
    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.error : `Request failed (${response.status})`,
      parsed.success ? parsed.data.details : undefined,
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(response.status, "The server sent an unexpected response.");
  return parsed.data;
}

export function fetchProgress(): Promise<Snapshot> {
  return request("/api/progress", SnapshotSchema);
}

export function patchProgress(ops: readonly Operation[], options: { keepalive?: boolean } = {}): Promise<Snapshot> {
  return request("/api/progress", SnapshotSchema, {
    method: "PATCH",
    body: JSON.stringify({ ops }),
    keepalive: options.keepalive,
  });
}

export function importProgress(progress: Progress): Promise<Snapshot & { orphans: string[] }> {
  return request("/api/progress/import", ImportResultSchema, { method: "POST", body: JSON.stringify(progress) });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
