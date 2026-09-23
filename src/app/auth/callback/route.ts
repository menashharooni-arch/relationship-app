import { NextRequest, NextResponse } from "next/server";
import { authFailedRedirect, landAfterAuth, routeSupabase } from "@/lib/auth-landing";

// OAuth round-trips (Google, Apple) and PKCE email links (?code=…) land here.
// Email links that carry a token_hash land on /auth/confirm instead; both hand
// off to the same lib/auth-landing so they route a signed-in person the same way.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // A visitor who cancels/denies on Google's screen comes back with an
  // `error` param and no code. Without this branch they fell through to
  // /dashboard, which (having no session) bounced them to /login with no
  // explanation — a confusing double-redirect. Send them straight to the
  // login form's existing "didn't complete" message instead.
  if (!code && searchParams.get("error")) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  if (code) {
    const supabase = await routeSupabase();

    // CRITICAL: if the exchange fails we must NOT fall through to getUser() —
    // a still-present previous session would silently log the visitor into the
    // OLD account (looks like their brand-new Google email "linked" to it).
    const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error("[auth/callback] code exchange failed:", exchangeError.message);
      // A team invite's emailed sign-in link opened in another browser (the
      // code verifier lives only in the one that asked) or opened twice: back
      // to the invite, which explains it and can send a fresh link — not the
      // generic login page, where the invite was lost and the only message
      // talked about building a card. Anything else keeps where they were
      // going (a claim=1 draft, a plan pick) through the login page.
      return authFailedRedirect(origin, next);
    }

    // Sign in with Apple: the provider refresh token exists ONLY here, on the
    // freshly exchanged session — identity_data never carries it. Persist it
    // now or account deletion can never revoke the Apple token (5.1.1(v)).
    // Best-effort: a storage failure must not break sign-in.
    try {
      const s = exchanged?.session;
      if (s?.provider_refresh_token && s.user?.app_metadata?.provider === "apple") {
        const { saveAppleRefreshToken } = await import("@/lib/apple-token-store");
        await saveAppleRefreshToken(s.user.id, s.provider_refresh_token);
      }
    } catch (e) {
      console.error("[auth/callback] apple token persist failed:", e);
    }

    return landAfterAuth(supabase, { origin, next, intent: searchParams.get("intent") });
  }

  return NextResponse.redirect(new URL("/dashboard", origin));
}
