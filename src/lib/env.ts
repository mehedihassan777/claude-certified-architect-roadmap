import { z } from "zod";

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

const requiredForGitHub = "is required when STORAGE_DRIVER=github";

const StorageEnvSchema = z.discriminatedUnion(
  "STORAGE_DRIVER",
  [
    z.object({
      STORAGE_DRIVER: z.literal("file"),
      PROGRESS_FILE_PATH: z.string().default("./data/progress.json"),
    }),
    z.object({
      STORAGE_DRIVER: z.literal("github"),
      GITHUB_TOKEN: z.string({ error: requiredForGitHub }),
      GITHUB_REPO: z.string({ error: requiredForGitHub }).regex(/^[\w.-]+\/[\w.-]+$/, "must look like owner/repo"),
      GITHUB_BRANCH: z.string().regex(/^[\w./-]+$/, "is not a valid branch name").default("main"),
      GITHUB_PROGRESS_PATH: z
        .string()
        .regex(/^(?!\/)(?!.*\.\.)[\w./-]+\.json$/, "must be a relative path to a .json file")
        .default("progress.json"),
    }),
  ],
  { error: 'must be "file" or "github"' },
);

/** Environment variables as read here; process.env satisfies it. */
export type Env = Readonly<Record<string, string | undefined>>;

export type StorageConfig =
  | { driver: "file"; filePath: string }
  | { driver: "github"; token: string; repo: string; branch: string; path: string };

/** Reads the storage settings; blank values count as unset. Error messages never include values. */
export function getStorageConfig(env: Env = process.env): StorageConfig {
  const value = (name: string) => env[name]?.trim() || undefined;
  const parsed = StorageEnvSchema.safeParse({
    STORAGE_DRIVER: value("STORAGE_DRIVER") ?? "file",
    PROGRESS_FILE_PATH: value("PROGRESS_FILE_PATH"),
    GITHUB_TOKEN: value("GITHUB_TOKEN"),
    GITHUB_REPO: value("GITHUB_REPO"),
    GITHUB_BRANCH: value("GITHUB_BRANCH"),
    GITHUB_PROGRESS_PATH: value("GITHUB_PROGRESS_PATH"),
  });
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".") || "STORAGE_DRIVER"} ${issue.message}`);
    throw new EnvError(`Invalid storage configuration: ${problems.join("; ")}`);
  }

  const vars = parsed.data;
  return vars.STORAGE_DRIVER === "file"
    ? { driver: "file", filePath: vars.PROGRESS_FILE_PATH }
    : {
        driver: "github",
        token: vars.GITHUB_TOKEN,
        repo: vars.GITHUB_REPO,
        branch: vars.GITHUB_BRANCH,
        path: vars.GITHUB_PROGRESS_PATH,
      };
}
