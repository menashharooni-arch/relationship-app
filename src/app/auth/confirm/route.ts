import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { authFailedRedirect, landAfterAuth, routeSupabase } from "@/lib/auth-landing";
import { nextFromConfirmUrl } from "@/lib/auth-confirm";

// ── Every SwiftCard email sign-in / confirm link lands here ──────────────────
//   https://swiftcard.me/auth/confirm?token_hash=…&type=…&(next=… | redirect_to=…)
//
// Two senders:
//   • Supabase Auth's emails (sign-up confirmation, sign-in link, email change,
//     invite), with templates from supabase/auth-email-templates.mjs applied by
//     scripts/supabase-auth-emails.mjs. They end with
//     &redirect_to={{ .RedirectTo }}. They used to be Supabase's defaults: no
//     SwiftCard name, and a grxmovpmlgmjncnyiyrt.supabase.co button — the exact
//     shape of a phishing email.
//   • The team invite's own sign-in email (api/join/sign-in-link), which
//     passes type=magiclink|signup and next=/join/<token>.
//
// The token hash is verified HERE, server-side, so the link works in whatever
// browser the email opens in. The old PKCE ?code= link only worked in the
// browser that asked for it (its verifier lives there): open it in Gmail's
// in-app browser, or on the phone for a laptop sign-up, and it failed.
//
// Success → lib/auth-landing, shared with /auth/callback: a new account to
// /onboarding?next=…, an existing one straight to next, a deleted one to the
// reopen screen. Failure (used, expired, mangled) → a /join invite goes back to
// its invite page, anything else to the login form keeping next.
// Password-reset links go straight to /auth/reset-password, which verifies its
// own token_hash; a recovery link that arrives here is forwarded there.

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = ["email", "signup", "magiclink", "invite", "email_change", "recovery"];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { origin, searchParams } = url;
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const next = nextFromConfirmUrl(url);

  if (!tokenHash || !rawType || !(EMAIL_OTP_TYPES as readonly string[]).includes(rawType)) {
    return authFailedRedirect(origin, next);
  }
  const type = rawType as EmailOtpType;

  if (type === "recovery") {
    const reset = new URL("/auth/reset-password", origin);
    reset.searchParams.set("token_hash", tokenHash);
    reset.searchParams.set("type", "recovery");
    return NextResponse.redirect(reset);
  }

  const supabase = await routeSupabase();
  // Replaces whatever session this browser held (a different account on a
  // shared computer) with the link's — that is what the link is. And, as in
  // /auth/callback: on a failed verify never fall through to getUser(), or a
  // session already here would land the person in THAT account.
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    console.error("[auth/confirm] verify failed:", error.message);
    return authFailedRedirect(origin, next);
  }
  return landAfterAuth(supabase, { origin, next });
}
