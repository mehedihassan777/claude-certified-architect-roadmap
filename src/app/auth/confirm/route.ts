import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * The link in Supabase's confirmation email lands here. It handles both link styles:
 * `?code=` (Supabase's default template, PKCE) and `?token_hash=&type=` (the custom template in the README).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createSupabaseServerClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && OTP_TYPES.includes(type as EmailOtpType)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })).error;
  }

  const target = url.clone();
  target.search = "";
  if (ok) {
    target.pathname = safeNextPath(url.searchParams.get("next"));
  } else {
    target.pathname = "/login";
    target.searchParams.set("notice", "confirm-failed");
  }
  return NextResponse.redirect(target);
}
