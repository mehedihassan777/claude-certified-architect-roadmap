import { describe, expect, it } from "vitest";
import { EnvError, getStorageConfig } from "./env";

describe("getStorageConfig", () => {
  it("defaults to the file driver and ./data/progress.json", () => {
    expect(getStorageConfig({})).toEqual({ driver: "file", filePath: "./data/progress.json" });
  });

  it("treats blank values as unset", () => {
    expect(getStorageConfig({ STORAGE_DRIVER: " ", PROGRESS_FILE_PATH: "" })).toEqual({
      driver: "file",
      filePath: "./data/progress.json",
    });
  });

  it("reads the github settings with defaults for branch and path", () => {
    expect(getStorageConfig({ STORAGE_DRIVER: "github", GITHUB_TOKEN: "t", GITHUB_REPO: "me/progress" })).toEqual({
      driver: "github",
      token: "t",
      repo: "me/progress",
      branch: "main",
      path: "progress.json",
    });
  });

  it("names every missing github setting", () => {
    expect(() => getStorageConfig({ STORAGE_DRIVER: "github" })).toThrow(
      "GITHUB_TOKEN is required when STORAGE_DRIVER=github; GITHUB_REPO is required when STORAGE_DRIVER=github",
    );
  });

  it("never echoes values in its errors", () => {
    const secret = "github_pat_should_not_leak";
    let message = "";
    try {
      getStorageConfig({ STORAGE_DRIVER: "github", GITHUB_TOKEN: secret, GITHUB_REPO: secret });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      message = (error as Error).message;
    }
    expect(message).toContain("GITHUB_REPO must look like owner/repo");
    expect(message).not.toContain(secret);
  });

  it("rejects an unknown driver and unsafe progress paths", () => {
    expect(() => getStorageConfig({ STORAGE_DRIVER: "s3" })).toThrow('STORAGE_DRIVER must be "file" or "github"');
    expect(() =>
      getStorageConfig({ STORAGE_DRIVER: "github", GITHUB_TOKEN: "t", GITHUB_REPO: "a/b", GITHUB_PROGRESS_PATH: "../x.json" }),
    ).toThrow("GITHUB_PROGRESS_PATH must be a relative path to a .json file");
  });
});
