import { z } from "zod";
import { emptyProgress, ProgressSchema, type Progress } from "@/lib/progress/schema";
import { parseStoredProgress, serializeProgress } from "./codec";
import {
  StoreUnavailableError,
  VersionConflictError,
  type ProgressStore,
  type StoredProgress,
  type WriteOptions,
} from "./types";

/** Newest REST API version (checked 2026-09-28); its breaking changes don't touch single-file Contents calls. */
export const GITHUB_API_VERSION = "2026-03-10";

export interface GitHubStoreConfig {
  token: string;
  /** owner/name of the private repo that holds progress.json. */
  repo: string;
  branch: string;
  /** File path inside that repo, e.g. progress.json. */
  path: string;
}

export interface GitHubStoreOptions {
  fetch?: typeof fetch;
  clock?: () => Date;
  timeoutMs?: number;
}

const FileResponseSchema = z.object({
  type: z.literal("file"),
  encoding: z.string(),
  content: z.string(),
  sha: z.string().min(1),
});

const PutResponseSchema = z.object({
  content: z.object({ sha: z.string().min(1) }),
});

/**
 * Progress in a file of a separate private repo, through the GitHub Contents API. The version is
 * the file's blob sha: a PUT with a stale sha gets 409, which becomes VersionConflictError.
 */
export class GitHubStore implements ProgressStore {
  private readonly config: GitHubStoreConfig;
  private readonly contentsUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => Date;
  private readonly timeoutMs: number;

  constructor(config: GitHubStoreConfig, options: GitHubStoreOptions = {}) {
    this.config = config;
    const filePath = config.path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    this.contentsUrl = `https://api.github.com/repos/${config.repo}/contents/${filePath}`;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.clock = options.clock ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  read(): Promise<StoredProgress> {
    return this.readOrCreate(true);
  }

  async write(data: Progress, expectedVersion: string, options: WriteOptions = {}): Promise<{ version: string }> {
    return this.put(ProgressSchema.parse(data), expectedVersion, options.message ?? "progress: update");
  }

  private async readOrCreate(createIfMissing: boolean): Promise<StoredProgress> {
    const response = await this.request("GET", `${this.contentsUrl}?ref=${encodeURIComponent(this.config.branch)}`);
    if (response.status === 404 && createIfMissing) return this.create();
    if (!response.ok) throw await this.failure(response, "read");

    const file = FileResponseSchema.safeParse(await response.json().catch(() => null));
    if (!file.success) {
      throw new StoreUnavailableError(`GitHub returned something other than a file for ${this.describe()}.`);
    }
    if (file.data.encoding !== "base64") {
      throw new StoreUnavailableError(`${this.describe()} is too large for the GitHub Contents API (over 1 MB).`);
    }
    const bytes = Buffer.from(file.data.content, "base64");
    return { data: parseStoredProgress(bytes, this.describe(), file.data.sha), version: file.data.sha };
  }

  private async create(): Promise<StoredProgress> {
    const data = emptyProgress(this.clock());
    try {
      const { version } = await this.put(data, undefined, "progress: create progress file");
      return { data, version };
    } catch (error) {
      // Another instance created the file between our GET and PUT, so read that one instead.
      if (error instanceof VersionConflictError) return this.readOrCreate(false);
      throw error;
    }
  }

  private async put(data: Progress, sha: string | undefined, message: string): Promise<{ version: string }> {
    const body = JSON.stringify({
      message,
      content: Buffer.from(serializeProgress(data), "utf8").toString("base64"),
      branch: this.config.branch,
      ...(sha === undefined ? {} : { sha }),
    });
    const response = await this.request("PUT", this.contentsUrl, body);
    // 409: our sha is stale. 422 on a create: the file already exists.
    if (response.status === 409 || (response.status === 422 && sha === undefined)) {
      throw new VersionConflictError(`${this.describe()} changed on GitHub since it was read`);
    }
    if (!response.ok) throw await this.failure(response, "write");

    const result = PutResponseSchema.safeParse(await response.json().catch(() => null));
    if (!result.success) {
      throw new StoreUnavailableError("GitHub accepted the write but returned an unexpected response.");
    }
    return { version: result.data.content.sha };
  }

  private async request(method: "GET" | "PUT", url: string, body?: string): Promise<Response> {
    try {
      return await this.fetchImpl(url, {
        method,
        body,
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.config.token}`,
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
          "User-Agent": "cca-f-roadmap",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new StoreUnavailableError(`Could not reach GitHub: ${reason}`, { cause: error });
    }
  }

  private async failure(response: Response, action: "read" | "write"): Promise<StoreUnavailableError> {
    const payload: unknown = await response.json().catch(() => null);
    const githubMessage =
      typeof payload === "object" && payload !== null && "message" in payload ? String(payload.message) : "";
    const rateLimited = response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0";
    const hint =
      response.status === 401
        ? "GITHUB_TOKEN is invalid or expired"
        : rateLimited
          ? "the GitHub API rate limit was reached; try again later"
          : response.status === 403
            ? "GITHUB_TOKEN needs Contents read and write permission on this repository"
            : response.status === 404
              ? "the repository, branch or path wasn't found, or the token can't see the repository"
              : `GitHub responded with HTTP ${response.status}`;
    const detail = githubMessage ? ` GitHub said: "${githubMessage}"` : "";
    return new StoreUnavailableError(`Could not ${action} ${this.describe()}: ${hint}.${detail}`);
  }

  private describe(): string {
    return `${this.config.repo}/${this.config.path} on branch ${this.config.branch}`;
  }
}
