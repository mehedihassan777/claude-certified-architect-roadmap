import "server-only";
import { cache } from "react";
import { getSupabaseConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
  isAdmin: boolean;
}

/**
 * The signed-in user, verified with getClaims() (never getSession(), which trusts the cookie).
 * Cached per request, so the layout, pages and handlers share one check.
 */
export const getAuth = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? null : data?.claims;
  const user: SessionUser | null = claims
    ? {
        id: claims.sub,
        email: typeof claims.email === "string" ? claims.email : null,
        isAdmin: claims.sub.toLowerCase() === getSupabaseConfig().adminUserId,
      }
    : null;
  return { supabase, user };
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getAuth()).user;
}
