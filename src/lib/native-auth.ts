import type { SupabaseClient } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/safe-next";

/**
 * Native-shell OAuth sign-in (Google / Apple) for the Capacitor iOS app.
 *
 * GOOGLE takes its own route — see startNativeGoogleLogin() below and
 * src/lib/native-google-login.ts. Short version: letting Supabase broker Google
 * meant Google printed ITS redirect host on the account chooser
 * ("to continue to grxmovpmlgmjncnyiyrt.supabase.co"), which is what every app
 * user saw. We now run the authorization-code leg ourselves with a swiftcard.me
 * redirect_uri, so the chooser reads swiftcard.me, and the webview finishes with
 * signInWithIdToken — the same call the website's Google button already makes.
 * APPLE still uses the Supabase-brokered PKCE flow described here (Apple's sheet
 * shows the app, never a Supabase host, so it has nothing to fix).
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
// Sign-in vs create intent, stashed alongside `next` so the post-callback
// navigation can tell /onboarding to bounce a no-account SIGN-IN (Task 4).
const INTENT_KEY = "swiftcard_native_oauth_intent";
// The secret that proves, on re-entry, that THIS webview is the one that started
// the Google sign-in — the custom scheme is not exclusive on iOS, so the sealed
// ticket must be redeemable by nobody else. localStorage for the same reason
// `next` is: iOS can terminate the app while the browser sheet is open.
const HANDOFF_KEY = "swiftcard_native_google_handoff";

export function stashNativeOAuthNext(next: string | null | undefined, intent?: "signin" | "signup"): void {
  try {
    if (next && safeNextPath(next)) {
      localStorage.setItem(NEXT_KEY, next);
    } else {
      localStorage.removeItem(NEXT_KEY);
    }
    if (intent === "signin") localStorage.setItem(INTENT_KEY, "signin");
    else localStorage.removeItem(INTENT_KEY);
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

function consumeNativeOAuthIntent(): string | null {
  try {
    const v = localStorage.getItem(INTENT_KEY);
    localStorage.removeItem(INTENT_KEY);
    return v;
  } catch {
    return null;
  }
}

/** Open a URL in the system browser sheet (SFSafariViewController). false means
 *  the plugin isn't in this build — a very old shell — and the caller decides. */
async function openSystemBrowser(url: string): Promise<boolean> {
  try {
    const { Browser } = await import("@capacitor/browser");
    // "fullscreen", not "popover": popover renders as a small anchored bubble on
    // iPadOS (App Review tests on iPad Air), which is no way to show an auth
    // page; fullscreen is the standard SFSafariViewController presentation on
    // both device classes.
    await Browser.open({ url, presentationStyle: "fullscreen" });
    return true;
  } catch {
    return false;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * GOOGLE, brokered by us: open our own /start leg in the system browser, having
 * first stashed a handoff secret and sent only its SHA-256. The return leg seals
 * the Google ID token against that hash, so only this webview can redeem it.
 *
 * `{ ok: false }` means the device could not set the handoff up at all (no
 * localStorage in private mode, no WebCrypto, no Browser plugin). Sign-in must
 * still work, so the caller falls back to the Supabase-brokered flow — the
 * chooser says supabase.co there, which is ugly but far better than a dead
 * button.
 */
async function startNativeGoogleLogin(): Promise<{ ok: true; error: string | null } | { ok: false }> {
  let handoff: string;
  try {
    handoff = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    localStorage.setItem(HANDOFF_KEY, handoff);
  } catch {
    return { ok: false };
  }

  let hs: string;
  try {
    hs = await sha256Hex(handoff);
  } catch {
    return { ok: false };
  }

  // Same origin as the running app (https://swiftcard.me in the shell), so this
  // works unchanged against a preview deployment.
  const url = `${window.location.origin}/api/auth/google/native/start?hs=${hs}`;
  if (!(await openSystemBrowser(url))) return { ok: false };
  return { ok: true, error: null };
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
  intent?: "signin" | "signup",
): Promise<string | null> {
  stashNativeOAuthNext(redirectTo, intent);

  // Google runs through our own authorization-code leg so its account chooser
  // names swiftcard.me. Anything that stops the sealed handoff from being set up
  // falls through to the Supabase-brokered flow below rather than failing.
  if (provider === "google") {
    const started = await startNativeGoogleLogin();
    if (started.ok) return started.error;
  }

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
  if (!(await openSystemBrowser(data.url))) {
    // Plugin missing (very old shell build) — last resort: navigate the
    // webview itself. Google may refuse; Apple generally works.
    window.location.href = data.url;
  }
  return null;
}

/** Trade the sealed ticket for the Google ID token inside it. Null on any
 *  failure — expired, tampered, or a ticket meant for a different webview. */
async function redeemGoogleTicket(ticket: string): Promise<string | null> {
  let secret: string | null = null;
  try {
    secret = localStorage.getItem(HANDOFF_KEY);
    localStorage.removeItem(HANDOFF_KEY); // one shot, whatever happens next
  } catch { /* no storage — the redeem below will fail cleanly */ }
  if (!secret) return null;

  try {
    const res = await fetch("/api/auth/google/native/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket, secret }),
    });
    if (!res.ok) return null;
    const { idToken } = (await res.json()) as { idToken?: string };
    return idToken || null;
  } catch {
    return null;
  }
}

/**
 * Step 4: called by NativeAppBridge with the swiftcard://auth-callback URL.
 * Exchanges the code (Apple) or redeems the sealed ticket (Google) inside the
 * webview and navigates onward. Returns true if it handled the URL.
 */
export async function completeNativeOAuth(supabase: SupabaseClient, url: string): Promise<boolean> {
  let code: string | null = null;
  let ticket: string | null = null;
  let errParam: string | null = null;
  try {
    const u = new URL(url);
    // Accept swiftcard://auth-callback in both authority and path forms.
    if (u.protocol !== "swiftcard:") return false;
    code = u.searchParams.get("code");
    ticket = u.searchParams.get("gt");
    errParam = u.searchParams.get("error_description") || u.searchParams.get("error");
  } catch {
    return false;
  }

  const next = consumeNativeOAuthNext();
  const intent = consumeNativeOAuthIntent();

  // Mirror the web GIS flow: new-or-existing users route through /onboarding,
  // which provisions and forwards to `next` (or the dashboard) — or, for a
  // no-account SIGN-IN, bounces to Create-account (Task 4).
  const onward = () => {
    const params = new URLSearchParams();
    if (next) params.set("next", next);
    if (intent === "signin") params.set("intent", "signin");
    const qs = params.toString();
    window.location.href = qs ? `/onboarding?${qs}` : "/onboarding";
  };

  // GOOGLE: the ID token is sealed in the ticket; redeem it and let Supabase
  // mint the session HERE, in the webview, so the cookies land in the store the
  // app actually reads (the system browser's jar is a different one).
  if (ticket) {
    const idToken = await redeemGoogleTicket(ticket);
    if (!idToken) {
      window.location.href = "/login?error=oauth";
      return true;
    }
    // No nonce on either side: our /start leg sends none, so Google mints no
    // nonce claim, and Supabase requires the two to match in presence.
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
    if (error) {
      window.location.href = "/login?error=oauth";
      return true;
    }
    onward();
    return true;
  }

  if (!code) {
    // Provider round-trip failed or was cancelled — back to login with the
    // same error surface the web flow uses.
    window.location.href = errParam ? "/login?error=oauth" : "/login";
    return true;
  }

  const { data: exchanged, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    window.location.href = "/login?error=oauth";
    return true;
  }

  // Apple only: the provider refresh token exists solely on this freshly
  // exchanged session, and account deletion needs it to revoke at Apple
  // (5.1.1(v)). The web flow stores it server-side in /auth/callback; here the
  // exchange had to happen in the webview (the PKCE verifier lives in webview
  // storage), so hand it to the API — which stores it under the session user,
  // cookie-authenticated. Best-effort: never block login on it.
  try {
    const s = exchanged?.session;
    if (s?.provider_refresh_token && s.user?.app_metadata?.provider === "apple") {
      await fetch("/api/auth/apple-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ refreshToken: s.provider_refresh_token }),
      });
    }
  } catch { /* stored next sign-in instead */ }

  onward();
  return true;
}
