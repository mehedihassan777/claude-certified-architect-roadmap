"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./rules";

export interface AuthFormState {
  error?: string;
  /** Shown after sign-up when Supabase sends a confirmation email. */
  notice?: string;
  email?: string;
}

const SignInSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }),
  password: z.string().min(1, { error: "Enter your password." }),
});

const SignUpSchema = z
  .object({
    email: z.email({ error: "Enter a valid email address." }),
    password: z.string().min(MIN_PASSWORD_LENGTH, { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` }).max(MAX_PASSWORD_LENGTH, { error: `Use at most ${MAX_PASSWORD_LENGTH} characters.` }),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { error: "The passwords don't match.", path: ["confirm"] });

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export async function signIn(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = field(form, "email").trim();
  const parsed = SignInSchema.safeParse({ email, password: field(form, "password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const unconfirmed = error.code === "email_not_confirmed";
    return { error: unconfirmed ? "Confirm your email first: check your inbox for the link." : "Wrong email or password.", email };
  }
  redirect(safeNextPath(form.get("next")));
}

export async function signUp(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = field(form, "email").trim();
  const parsed = SignUpSchema.safeParse({ email, password: field(form, "password"), confirm: field(form, "confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${await origin()}/auth/confirm` },
  });
  if (error) return { error: error.message, email };
  // With "Confirm email" off in Supabase, sign-up returns a session straight away.
  if (data.session) redirect("/");
  return { notice: `We sent a confirmation link to ${parsed.data.email}. Open it to finish creating your account.`, email };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
