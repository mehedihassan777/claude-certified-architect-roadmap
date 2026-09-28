/** Last queued promise per key: a Map for string keys, a WeakMap for object keys. */
interface Tails<K> {
  get(key: K): Promise<unknown> | undefined;
  set(key: K, value: Promise<unknown>): unknown;
}

/** Runs `task` once every task queued earlier under the same key has settled. */
export function runExclusive<K, T>(tails: Tails<K>, key: K, task: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(task);
  tails.set(key, run.then(ignore, ignore));
  return run;
}

function ignore(): void {}
