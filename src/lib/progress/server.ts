import "server-only";
import { HttpError } from "@/lib/api/http";
import { getAuth } from "@/lib/auth";
import { DAY_NUMBERS, TASK_IDS } from "@/lib/content";
import { SupabaseStore, supabaseProgressRows } from "@/lib/storage/supabase-store";
import type { ProgressDeps } from "./service";

/** Dependencies for the route handlers: the signed-in user's progress row and the content's IDs. */
export async function serverDeps(): Promise<ProgressDeps> {
  const { supabase, user } = await getAuth();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return {
    store: new SupabaseStore(supabaseProgressRows(supabase), user.id),
    lockKey: user.id,
    taskIds: TASK_IDS,
    dayNumbers: DAY_NUMBERS,
  };
}
