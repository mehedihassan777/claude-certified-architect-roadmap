import { useSyncExternalStore } from "react";

/** The current time, refreshed every minute and when the tab becomes visible again. */
let current = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick(): void {
  current = Date.now();
  for (const listener of listeners) listener();
}

function onVisibility(): void {
  if (document.visibilityState === "visible") tick();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    current = Date.now();
    timer = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 0,
  );
}
