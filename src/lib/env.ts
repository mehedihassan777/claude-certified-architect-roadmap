import { z } from "zod";

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

const required = "is required";

const SupabaseEnvSchema = z.object({
  // http is allowed for a local Supabase started with the CLI (http://127.0.0.1:54321).
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/, error: "must be the project URL, e.g. https://abc.supabase.co" }).optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  ADMIN_USER_ID: z.uuid({ error: "must be a user UUID from Supabase → Authentication → Users" }).optional(),
});

/** Environment variables as read here; process.env satisfies it. */
export type Env = Readonly<Record<string, string | undefined>>;

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
  /** Server-only; bypasses RLS. Needed only by the admin page. */
  secretKey: string | null;
  /** The one account that may open /admin. */
  adminUserId: string | null;
}

/** Reads the Supabase settings; blank values count as unset. Error messages never include values. */
export function getSupabaseConfig(env: Env = process.env): SupabaseConfig {
  const value = (name: string) => env[name]?.trim() || undefined;
  const parsed = SupabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: value("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: value("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    SUPABASE_SECRET_KEY: value("SUPABASE_SECRET_KEY"),
    ADMIN_USER_ID: value("ADMIN_USER_ID"),
  });
  const problems = parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);
  const vars = parsed.success ? parsed.data : null;
  if (vars && !vars.NEXT_PUBLIC_SUPABASE_URL) problems.push(`NEXT_PUBLIC_SUPABASE_URL ${required}`);
  if (vars && !vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) problems.push(`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ${required}`);
  if (!vars || problems.length > 0) throw new EnvError(`Invalid Supabase configuration: ${problems.join("; ")}`);

  return {
    url: vars.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey: vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    secretKey: vars.SUPABASE_SECRET_KEY ?? null,
    adminUserId: vars.ADMIN_USER_ID?.toLowerCase() ?? null,
  };
}
