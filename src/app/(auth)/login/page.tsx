import type { Metadata } from "next";
import { SignInForm } from "@/components/auth-forms";
import { safeNextPath } from "@/lib/redirects";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  confirmed: "Your email is confirmed. Sign in to start.",
  "confirm-failed": "That confirmation link is invalid or has expired. Sign in, or register again to get a new one.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const notice = typeof params.notice === "string" ? NOTICES[params.notice] : undefined;
  return <SignInForm next={next} notice={notice} />;
}
