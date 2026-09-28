"use client";

import { createContext, use, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ContentIndex } from "@/lib/content/summary";
import { INITIAL_SYNC_STATE, ProgressSync, type SyncState } from "./progress-sync";

interface ProgressContextValue {
  sync: ProgressSync;
  index: ContentIndex;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ index, children }: { index: ContentIndex; children: ReactNode }) {
  const [value] = useState<ProgressContextValue>(() => ({
    index,
    sync: new ProgressSync({
      taskIds: new Set(index.days.flatMap((day) => day.tasks.map((task) => task.id))),
      dayNumbers: new Set(index.days.map((day) => day.day)),
    }),
  }));

  useEffect(() => {
    const { sync } = value;
    void sync.refresh();
    const refresh = () => void sync.refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onPageHide = () => sync.sendOnExit();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [value]);

  return <ProgressContext value={value}>{children}</ProgressContext>;
}

function useProgressContext(): ProgressContextValue {
  const value = use(ProgressContext);
  if (!value) throw new Error("useProgress must be used inside <ProgressProvider>");
  return value;
}

const serverState = () => INITIAL_SYNC_STATE;

/** Progress state plus the sync object for dispatching ops. The view is null until loaded. */
export function useProgress(): SyncState & { sync: ProgressSync } {
  const { sync } = useProgressContext();
  const state = useSyncExternalStore(sync.subscribe, sync.getState, serverState);
  return { ...state, sync };
}

export function useContentIndex(): ContentIndex {
  return useProgressContext().index;
}
