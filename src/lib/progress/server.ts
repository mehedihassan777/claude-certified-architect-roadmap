import { DAY_NUMBERS, TASK_IDS } from "@/lib/content";
import { getStore } from "@/lib/storage";
import type { ProgressDeps } from "./service";

/** Dependencies for the route handlers: the configured store and the content's IDs. */
export function serverDeps(): ProgressDeps {
  return { store: getStore(), taskIds: TASK_IDS, dayNumbers: DAY_NUMBERS };
}
