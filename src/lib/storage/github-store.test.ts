import { describe, expect, it, vi } from "vitest";
import { applyOperation } from "@/lib/progress/apply";
import { emptyProgress, type Progress } from "@/lib/progress/schema";
import { MAX_CONFLICT_RETRIES, updateProgress, type ProgressDeps } from "@/lib/progress/service";
import { serializeProgress } from "./codec";
import { GITHUB_API_VERSION, GitHubStore, type GitHubStoreConfig } from "./github-store";
import { CorruptProgressError, StoreUnavailableError, VersionConflictError } from "./types";

const clock = () => new Date("2026-10-01T09:00:00.000Z");
const config: GitHubStoreConfig = { token: "test-token", repo: "owner/progress", branch: "main", path: "progress.json" };
const TASK_IDS = new Set(["d01-t1", "d01-t2", "d01-t3", "d01-t4", "d01-t5", "d01-t6"]);

interface PutBody {
  message: string;
  content: string;
  branch: string;
  sha?: string;
}

interface RecordedRequest {
  method: string;
  url: string;
  headers: Headers;
  body: PutBody | undefined;
}

/** A small fake of the Contents API: one repo, blob shas sha1, sha2, … */
function fakeGitHub() {
  const files = new Map<string, { sha: string; base64: string }>();
  const requests: RecordedRequest[] = [];
  let nextSha = 1;
  let beforePut: (() => void) | undefined;

  const commit = (filePath: string, text: string): string => {
    const sha = `sha${nextSha++}`;
    files.set(filePath, { sha, base64: Buffer.from(text, "utf8").toString("base64") });
    return sha;
  };

  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as PutBody) : undefined;
    requests.push({ method, url: url.toString(), headers: new Headers(init?.headers), body });
    const filePath = decodeURIComponent(url.pathname.replace("/repos/owner/progress/contents/", ""));

    if (method === "GET") {
      const file = files.get(filePath);
      if (!file) return Response.json({ message: "Not Found" }, { status: 404 });
      // GitHub wraps base64 content at 60 characters.
      const content = file.base64.replace(/(.{60})/g, "$1\n");
      return Response.json({ type: "file", encoding: "base64", sha: file.sha, content });
    }
    if (method === "PUT" && body) {
      beforePut?.();
      const current = files.get(filePath);
      if (current && body.sha === undefined) {
        return Response.json({ message: 'Invalid request.\n\n"sha" wasn\'t supplied.' }, { status: 422 });
      }
      if (current ? body.sha !== current.sha : body.sha !== undefined) {
        return Response.json({ message: `${filePath} does not match ${body.sha}` }, { status: 409 });
      }
      const sha = commit(filePath, Buffer.from(body.content, "base64").toString("utf8"));
      return Response.json({ content: { sha, path: filePath } }, { status: current ? 200 : 201 });
    }
    return new Response(null, { status: 405 });
  });

  return {
    files,
    requests,
    fetch,
    commit,
    puts: () => requests.filter((request) => request.method === "PUT"),
    onPut: (hook: (() => void) | undefined) => {
      beforePut = hook;
    },
  };
}

function storeFor(github: ReturnType<typeof fakeGitHub>, overrides: Partial<GitHubStoreConfig> = {}): GitHubStore {
  return new GitHubStore({ ...config, ...overrides }, { fetch: github.fetch, clock });
}

function deps(store: GitHubStore): ProgressDeps {
  return { store, taskIds: TASK_IDS, dayNumbers: new Set([1]), clock, sleep: async () => {} };
}

function withTask(progress: Progress, taskId: string): Progress {
  return applyOperation(
    progress,
    { type: "setTask", taskId, done: true },
    { taskIds: TASK_IDS, dayNumbers: new Set([1]), now: "2026-10-01T08:00:00.000Z" },
  );
}

describe("GitHubStore", () => {
  it("creates progress.json on first read", async () => {
    const github = fakeGitHub();
    const { data, version } = await storeFor(github).read();

    expect(data).toEqual(emptyProgress(clock()));
    expect(version).toBe("sha1");
    const [put] = github.puts();
    expect(put?.body?.sha).toBeUndefined();
    expect(put?.body?.branch).toBe("main");
    expect(put?.body?.message).toBe("progress: create progress file");
    expect(Buffer.from(put?.body?.content ?? "", "base64").toString("utf8")).toBe(serializeProgress(data));
  });

  it("reads and decodes an existing file", async () => {
    const github = fakeGitHub();
    const stored = withTask(emptyProgress(clock()), "d01-t1");
    github.commit("progress.json", serializeProgress(stored));
    expect(await storeFor(github).read()).toEqual({ data: stored, version: "sha1" });
    expect(github.puts()).toHaveLength(0);
  });

  it("sends the sha it read and returns the new one", async () => {
    const github = fakeGitHub();
    const store = storeFor(github);
    const { data, version } = await store.read();
    const written = await store.write(withTask(data, "d01-t1"), version, { message: "progress: d01-t1 done" });

    expect(written.version).toBe("sha2");
    const last = github.puts().at(-1);
    expect(last?.body?.sha).toBe(version);
    expect(last?.body?.message).toBe("progress: d01-t1 done");
  });

  it("turns a stale sha (409) into VersionConflictError", async () => {
    const github = fakeGitHub();
    const store = storeFor(github);
    const { data, version } = await store.read();
    github.commit("progress.json", serializeProgress(withTask(data, "d01-t2")));
    await expect(store.write(withTask(data, "d01-t1"), version)).rejects.toBeInstanceOf(VersionConflictError);
  });

  it("sends the token, API version and branch, and encodes the path", async () => {
    const github = fakeGitHub();
    await storeFor(github, { path: "study notes/progress.json", branch: "data" }).read();

    const [get] = github.requests;
    expect(get?.url).toBe("https://api.github.com/repos/owner/progress/contents/study%20notes/progress.json?ref=data");
    expect(get?.headers.get("authorization")).toBe("Bearer test-token");
    expect(get?.headers.get("x-github-api-version")).toBe(GITHUB_API_VERSION);
    expect(get?.headers.get("accept")).toBe("application/vnd.github+json");
    expect(github.puts()[0]?.body?.branch).toBe("data");
  });

  it("re-reads and re-applies when another device commits first", async () => {
    const github = fakeGitHub();
    const store = storeFor(github);
    await store.read();
    let first = true;
    github.onPut(() => {
      if (!first) return;
      first = false;
      const other = withTask(emptyProgress(clock()), "d01-t2");
      github.commit("progress.json", serializeProgress(other));
    });

    const saved = await updateProgress([{ type: "setTask", taskId: "d01-t1", done: true }], deps(store));
    expect(saved.data.tasks["d01-t1"]?.done).toBe(true);
    expect(saved.data.tasks["d01-t2"]?.done).toBe(true);
    expect((await store.read()).data).toEqual(saved.data);
  });

  it(`gives up after ${MAX_CONFLICT_RETRIES} retries`, async () => {
    const github = fakeGitHub();
    const store = storeFor(github);
    await store.read();
    let n = 2;
    github.onPut(() => {
      const other = withTask(emptyProgress(clock()), `d01-t${n++}`);
      github.commit("progress.json", serializeProgress(other));
    });

    await expect(
      updateProgress([{ type: "setTask", taskId: "d01-t1", done: true }], deps(store)),
    ).rejects.toBeInstanceOf(VersionConflictError);
    expect(github.puts()).toHaveLength(1 + MAX_CONFLICT_RETRIES + 1);
  });

  it("reads the other instance's file when two instances create it at once", async () => {
    const github = fakeGitHub();
    const theirs = withTask(emptyProgress(clock()), "d01-t3");
    let first = true;
    github.onPut(() => {
      if (first) github.commit("progress.json", serializeProgress(theirs));
      first = false;
    });

    expect((await storeFor(github).read()).data).toEqual(theirs);
  });

  it("treats an invalid stored file as corrupt and never overwrites it with an operation", async () => {
    const github = fakeGitHub();
    github.commit("progress.json", "{ not json");
    const store = storeFor(github);

    await expect(store.read()).rejects.toMatchObject({ name: "CorruptProgressError", version: "sha1" });
    await expect(
      updateProgress([{ type: "setTask", taskId: "d01-t1", done: true }], deps(store)),
    ).rejects.toBeInstanceOf(CorruptProgressError);
    expect(github.puts()).toHaveLength(0);
  });

  it.each([
    [401, {}, "GITHUB_TOKEN is invalid or expired"],
    [403, {}, "Contents read and write permission"],
    [403, { "x-ratelimit-remaining": "0" }, "rate limit"],
    [404, {}, "wasn't found"],
    [502, {}, "HTTP 502"],
  ])("explains a %i response", async (status, headers, message) => {
    const fetch = vi.fn(async () => Response.json({ message: "nope" }, { status, headers }));
    const store = new GitHubStore(config, { fetch, clock });
    const write = store.write(emptyProgress(clock()), "sha1");
    await expect(write).rejects.toBeInstanceOf(StoreUnavailableError);
    await expect(write).rejects.toThrow(message);
  });

  it("reports network failures as StoreUnavailableError", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const store = new GitHubStore(config, { fetch, clock });
    await expect(store.read()).rejects.toThrow("Could not reach GitHub: fetch failed");
  });
});
