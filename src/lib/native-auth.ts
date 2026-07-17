import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Native-shell OAuth sign-in (Google / Apple) for the Capacitor iOS app.
 *
 * WHY: OAuth inside an embedded WKWebView is unreliable — Google actively
 * blocks it (403 disallowed_useragent). The correct native pattern is:
 *
 *   1. Ask Supabase for the provider URL WITHOUT navigating
 *      (skipBrowserRedirect), with a custom-scheme redirect
 *      (swiftcard://auth-callback).
 *   2. Open that URL in the SYSTEM browser sheet (@capacitor/browser →
 *      SFSafariViewController) — a first-class browser Google accepts.
 *   3. After auth, Supabase redirects to swiftcard://auth-callback?code=…,
 *      which iOS routes straight back into the app (custom URL scheme,
 *      registered in Info.plist).
 *   4. NativeAppBridge receives the URL via appUrlOpen and calls
 *      completeNativeOAuth() below: exchange the code for a session inside
 *      the webview (the PKCE verifier was stored by step 1 in the webview's
 *      own storage, so the exchange succeeds), then continue to onboarding.
 *
 * OWNER CONFIG (one-time, documented in SHELL-RUNBOOK): add
 * `swiftcard://auth-callback` to Supabase → Auth → URL Configuration →
 * Redirect URLs. Until then the provider round-trip errors at the redirect
 * step; email/password remains the guaranteed native login.
 *
 * Web is untouched: nothing here is imported outside native-gated call sites,
 * and the Browser plugin is loaded dynamically so it never enters the web
 * bundle.
 */

export const NATIVE_OAUTH_REDIRECT = "swiftcard://auth-callback";

// Where to send the user after the session lands (mirrors the web flows:
// everything routes through /onboarding, which provisions + forwards).
// localStorage, not sessionStorage: iOS can terminate the app while the
// system-browser sheet is open, and the recreated webview would lose a
// sessionStorage stash — the PKCE verifier survives (cookies), so login
// completes, but the post-login destination would be dropped.
const NEXT_KEY = "swiftcard_native_oauth_next";

export function stashNativeOAuthNext(next: string | null | undefined): void {
  try {
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      localStorage.setItem(NEXT_KEY, next);
    } else {
      localStorage.removeItem(NEXT_KEY);
    }
  } catch { /* private mode — land on the default */ }
}

function consumeNativeOAuthNext(): string | null {
  try {
    const v = localStorage.getItem(NEXT_KEY);
    localStorage.removeItem(NEXT_KEY);
    return v;
  } catch {
    return null;
  }
}

/**
 * Step 1+2: start the system-browser OAuth round-trip. Returns an error
 * message to surface, or null on success (the app will re-enter via the
 * custom scheme).
 */
export async function startNativeOAuth(
  supabase: SupabaseClient,
  provider: "google" | "apple",
  redirectTo?: string | null,
): Promise<string | null> {
  stashNativeOAuthNext(redirectTo);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: NATIVE_OAUTH_REDIRECT,
      skipBrowserRedirect: true,
      ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : {}),
    },
  });
  if (error || !data?.url) {
    return error?.message || "Sign-in isn't available right now — please try again.";
  }
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: data.url, presentationStyle: "popover" });
    return null;
  } catch {
    // Plugin missing (very old shell build) — last resort: navigate the
    // webview itself. Google may refuse; Apple generally works.
    window.location.href = data.url;
    return null;
  }
}

/**
 * Step 4: called by NativeAppBridge with the swiftcard://auth-callback URL.
 * Exchanges the code inside the webview and navigates onward. Returns true
 * if it handled the URL.
 */
export async function completeNativeOAuth(supabase: SupabaseClient, url: string): Promise<boolean> {
  let code: string | null = null;
  let errParam: string | null = null;
  try {
    const u = new URL(url);
    // Accept swiftcard://auth-callback in both authority and path forms.
    if (u.protocol !== "swiftcard:") return false;
    code = u.searchParams.get("code");
    errParam = u.searchParams.get("error_description") || u.searchParams.get("error");
  } catch {
    return false;
  }

  const next = consumeNativeOAuthNext();

  if (!code) {
    // Provider round-trip failed or was cancelled — back to login with the
    // same error surface the web flow uses.
    window.location.href = errParam ? "/login?error=oauth" : "/login";
    return true;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    window.location.href = "/login?error=oauth";
    return true;
  }

  // Mirror the web GIS flow: new-or-existing users route through /onboarding,
  // which provisions and forwards to `next` (or the dashboard).
  window.location.href = next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding";
  return true;
}
