import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EnvError, getSupabaseConfig } from "@/lib/env";

/**
 * A client with the secret key: it bypasses row-level security and can manage users. Server-only,
 * used by the admin page after it has checked that the caller is the admin.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const { url, secretKey } = getSupabaseConfig();
  if (!secretKey) throw new EnvError("SUPABASE_SECRET_KEY is required for the admin page.");
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
