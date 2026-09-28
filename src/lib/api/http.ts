import { z } from "zod";
import { EnvError } from "@/lib/env";
import { OperationError } from "@/lib/progress/apply";
import { CorruptProgressError, StoreUnavailableError, VersionConflictError } from "@/lib/storage/types";

export const MAX_BODY_BYTES = 1_000_000;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** JSON response that no browser, proxy or CDN may cache. */
export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

/** Runs a handler and turns known errors into JSON error responses. */
export async function handle(
  request: Request,
  action: () => Promise<Response>,
  options: { mutating?: boolean } = {},
): Promise<Response> {
  try {
    if (options.mutating) assertSameOrigin(request);
    return await action();
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, "Request body is too large");
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new HttpError(413, "Request body is too large");

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body is not valid JSON");
  }
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, "Request body is invalid", z.prettifyError(result.error));
  return result.data;
}

/**
 * Browsers send Origin on every PATCH and POST, so a mismatch means another site sent the request.
 * Requests without Origin come from non-browser clients, and the session check covers them.
 */
function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin === null) return;
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    new URL(request.url).host;
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // "null" or malformed
  }
  if (originHost !== host) throw new HttpError(403, "Cross-origin request rejected");
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.message, ...(error.details ? { details: error.details } : {}) }, { status: error.status });
  }
  if (error instanceof OperationError) return json({ error: error.message }, { status: 422 });
  if (error instanceof VersionConflictError) {
    return json({ error: "Progress changed on another device while saving. Try again." }, { status: 409 });
  }
  if (error instanceof CorruptProgressError) return json({ error: error.message }, { status: 500 });
  if (error instanceof StoreUnavailableError || error instanceof EnvError) {
    return json({ error: error.message }, { status: 503 });
  }
  console.error(error);
  return json({ error: "Internal server error" }, { status: 500 });
}
