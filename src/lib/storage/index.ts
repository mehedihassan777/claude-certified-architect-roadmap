import { getStorageConfig, type Env, type StorageConfig } from "@/lib/env";
import { FileStore } from "./file-store";
import { GitHubStore } from "./github-store";
import type { ProgressStore } from "./types";

const stores = new Map<string, ProgressStore>();

/** The store selected by STORAGE_DRIVER, one instance per configuration. */
export function getStore(env: Env = process.env): ProgressStore {
  const config = getStorageConfig(env);
  const key = JSON.stringify(config);
  let store = stores.get(key);
  if (!store) {
    store = createStore(config);
    stores.set(key, store);
  }
  return store;
}

function createStore(config: StorageConfig): ProgressStore {
  switch (config.driver) {
    case "file":
      return new FileStore(config.filePath);
    case "github":
      return new GitHubStore(config);
  }
}
