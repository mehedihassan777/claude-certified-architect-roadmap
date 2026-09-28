"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/(auth)/actions";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/app/(auth)/rules";
import { AlertIcon, CheckIcon, SpinnerIcon } from "./icons";
import { buttonStyles, Card, cx } from "./ui";

const inputStyles =
  "block w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:ring-4 focus:ring-ring focus:outline-none";

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-3">{hint}</span> : null}
    </label>
  );
}

function FormMessage({ state }: { state: AuthFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2.5 text-sm text-bad">
        <AlertIcon className="mt-0.5 size-4 shrink-0" /> {state.error}
      </p>
    );
  }
  return null;
}

function Submit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={pending} className={cx(buttonStyles.primary, "w-full")}>
      {pending ? <SpinnerIcon className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function SignInForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <Card className="p-6 sm:p-7">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-2">Sign in to pick up where you left off.</p>
      {notice ? <p className="mt-4 rounded-xl bg-good-soft px-3 py-2.5 text-sm text-good">{notice}</p> : null}
      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required defaultValue={state.email} className={inputStyles} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" autoComplete="current-password" required className={inputStyles} />
        </Field>
        <FormMessage state={state} />
        <Submit pending={pending}>Sign in</Submit>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        New here?{" "}
        <Link href="/register" className="font-semibold text-accent hover:text-accent-hover">
          Create an account
        </Link>
      </p>
    </Card>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, {});
  if (state.notice) {
    return (
      <Card className="p-6 text-center sm:p-7">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-good-soft text-good">
          <CheckIcon className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-ink-2">{state.notice}</p>
        <Link href="/login" className={cx(buttonStyles.secondary, "mt-6")}>
          Back to sign in
        </Link>
      </Card>
    );
  }
  return (
    <Card className="p-6 sm:p-7">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-ink-2">Your progress is private to your account and syncs across devices.</p>
      <form action={action} className="mt-6 space-y-4">
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required defaultValue={state.email} className={inputStyles} />
        </Field>
        <Field label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
          <input name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} className={inputStyles} />
        </Field>
        <Field label="Confirm password">
          <input name="confirm" type="password" autoComplete="new-password" required className={inputStyles} />
        </Field>
        <FormMessage state={state} />
        <Submit pending={pending}>Create account</Submit>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-accent hover:text-accent-hover">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
