import { NextResponse } from "next/server";
import {
  GOOGLE_TOKEN_URL,
  NATIVE_AUTH_CALLBACK,
  NATIVE_GOOGLE_REDIRECT_PATH,
  sealIdTokenTicket,
  verifyNativeGoogleState,
} from "@/lib/native-google-login";

/**
 * Google's return leg for the shell's Google sign-in (see native-google-login.ts
 * for the whole design and why Google lands on an /api/integrations/ path).
 *
 * Runs in the SYSTEM browser, whose cookie jar is not the webview's — so this
 * never mints a session here. It exchanges the code for a Google ID token,
 * seals it against the handoff hash the state carries, and bounces the sealed
 * ticket back into the app over swiftcard://auth-callback, where the WEBVIEW
 * trades it for a Supabase session with signInWithIdToken.
 *
 * Every failure exits the same way: swiftcard://auth-callback?error=oauth, which
 * completeNativeOAuth() already turns into /login?error=oauth. The app must
 * always be re-entered — leaving the user staring at a dead browser sheet is the
 * one outcome worse than a failed sign-in.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

function fail(reason: string) {
  // `reason` is for our own logs/telemetry only — the app shows one message.
  return NextResponse.redirect(`${NATIVE_AUTH_CALLBACK}?error=oauth&reason=${encodeURIComponent(reason)}`);
}

export async function handleNativeGoogleLoginCallback(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");

  // Verified FIRST: an unsigned or expired state means this round-trip is not
  // one we started, and the handoff hash it carries is what makes the ticket
  // redeemable by exactly one webview.
  const handoffHash = verifyNativeGoogleState(searchParams.get("state"));
  if (!handoffHash) return fail("state");

  // User tapped Cancel at Google, or Google refused.
  if (providerError || !code) return fail(providerError || "no_code");

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error("[native-google-login] GOOGLE_CLIENT_ID/SECRET missing in this environment");
    return fail("config");
  }

  let idToken: string | undefined;
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        // Must match the /start leg byte-for-byte or Google rejects the exchange.
        redirect_uri: `${APP_URL}${NATIVE_GOOGLE_REDIRECT_PATH}`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      console.error("[native-google-login] token exchange failed:", tokenRes.status);
      return fail("exchange");
    }
    ({ id_token: idToken } = (await tokenRes.json()) as { id_token?: string });
  } catch (e) {
    console.error("[native-google-login] token exchange threw:", e);
    return fail("exchange");
  }

  // No ID token means the `openid` scope did not come back — nothing to sign in
  // with. Never fall through to a half-finished session.
  if (!idToken) return fail("no_id_token");

  const ticket = sealIdTokenTicket(idToken, handoffHash);
  return NextResponse.redirect(`${NATIVE_AUTH_CALLBACK}?gt=${encodeURIComponent(ticket)}`);
}
