import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { encryptToken, decryptToken } from "@/lib/token-crypto";

/**
 * ── Native Google sign-in, brokered by US instead of Supabase ───────────────
 *
 * THE PROBLEM THIS SOLVES
 * The iOS shell used to sign in with `supabase.auth.signInWithOAuth("google")`,
 * which sends the user to Google with Supabase's OWN redirect_uri
 * (https://grxmovpmlgmjncnyiyrt.supabase.co/auth/v1/callback). Google prints the
 * redirect target on its account chooser, so every app user read:
 *
 *     "Choose an account — to continue to grxmovpmlgmjncnyiyrt.supabase.co"
 *
 * The website never had this problem: it signs in with Google Identity Services
 * (src/components/GoogleSignInButton.tsx), where Google keys the consent text off
 * the authorized JS ORIGIN and therefore prints swiftcard.me. GIS is a browser-only
 * surface (FedCM, no WKWebView support), so the shell could not simply reuse it.
 *
 * The fix is to run the ordinary authorization-code flow ourselves, with a
 * redirect_uri on OUR domain, and hand the resulting Google ID token to the
 * webview — which then calls the SAME `signInWithIdToken` the web GIS button
 * already uses. Google now prints swiftcard.me, and Supabase still mints the
 * session, so nothing about accounts or identity changes (Google's `sub` claim is
 * stable across flows — an existing Google user maps to their existing row).
 *
 * WHY THE REDIRECT URI IS AN /api/integrations/ PATH
 * Authorized redirect URIs are Google Cloud console config, not repo config. The
 * console already has exactly one swiftcard.me URI registered —
 * /api/integrations/google/callback, from the CRM contacts connect — so this flow
 * lands there too and that route dispatches login-purpose states back here. That
 * keeps the fix pure code: it works the moment it deploys, with no console change
 * standing between Aaron and a working account chooser. If a dedicated URI is ever
 * registered, point NATIVE_GOOGLE_REDIRECT_PATH at
 * /api/auth/google/native/callback (that route already exists and serves the same
 * handler) and delete the dispatch — nothing else moves.
 *
 * THE HANDOFF, AND WHY IT IS SEALED
 * The Google round-trip runs in the SYSTEM browser (SFSafariViewController): its
 * cookie jar is not the webview's, so a session minted there would land in the
 * wrong browser. The return leg therefore re-enters the app over the
 * `swiftcard://` custom scheme, exactly like the existing Apple/PKCE flow. Custom
 * schemes are not exclusive on iOS — any installed app can claim `swiftcard://` —
 * so the ID token must never ride that URL in the clear. Instead:
 *
 *   1. the webview mints a random handoff secret, keeps it in localStorage, and
 *      sends only its SHA-256 to /start, which binds the hash into the signed state;
 *   2. the callback seals {ID token, that hash} with encryptToken (AES-256-GCM,
 *      server key) and puts the opaque ticket on the swiftcard:// URL;
 *   3. the webview POSTs ticket + secret to /redeem, which unseals only when
 *      SHA-256(secret) matches the bound hash.
 *
 * An interceptor gets ciphertext it cannot read and cannot redeem — the same
 * protection PKCE gives the Apple leg. Tickets expire in 3 minutes.
 *
 * Server-only module: it reads OAUTH_SECRET and GOOGLE_CLIENT_SECRET.
 */

/** Marks a `state` as belonging to this login flow (vs. the CRM connect flow,
 *  whose states are signState() user tokens). Also makes the two impossible to
 *  confuse: oauth-state's verifyState() splits on "." and requires exactly two
 *  parts, so a prefixed three-part state fails it closed regardless. */
export const NATIVE_GOOGLE_STATE_PREFIX = "ngl1.";

/** The redirect_uri sent to Google — must be registered verbatim in the Google
 *  Cloud console (see the header note above for why it is the integrations path). */
export const NATIVE_GOOGLE_REDIRECT_PATH = "/api/integrations/google/callback";

/** Login only: identity, nothing else. These are NON-SENSITIVE scopes, so they
 *  do not trigger the "Google hasn't verified this app" interstitial the CRM's
 *  contacts scope does. */
export const NATIVE_GOOGLE_SCOPES = "openid email profile";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Where the sealed ticket re-enters the app. NativeAppBridge already routes
 *  swiftcard://auth-callback into completeNativeOAuth(). */
export const NATIVE_AUTH_CALLBACK = "swiftcard://auth-callback";

const STATE_MAX_AGE_MS = 15 * 60 * 1000; // the user has 15 min to finish at Google
const TICKET_MAX_AGE_MS = 3 * 60 * 1000; // app re-entry is immediate; 3 min is slack

// Domain separation: OAUTH_SECRET also signs CRM connect states. Tagging the
// payload means a state minted for one purpose can never verify for the other.
const STATE_DOMAIN = "swiftcard.native-google-login.state.v1|";

function getSecret(): string {
  const s = process.env.OAUTH_SECRET || "";
  if (!s) throw new Error("OAUTH_SECRET missing — refusing to sign native Google login state");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(STATE_DOMAIN + payload).digest("base64url");
}

/** Constant-time string compare that is safe for unequal lengths. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** SHA-256 hex of the webview's handoff secret. The secret itself never leaves
 *  the device until the redeem POST. */
export function hashHandoff(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function isNativeGoogleLoginState(state: string | null | undefined): boolean {
  return typeof state === "string" && state.startsWith(NATIVE_GOOGLE_STATE_PREFIX);
}

/** Build the signed `state` carrying the handoff hash through Google. */
export function signNativeGoogleState(handoffHash: string): string {
  const payload = `${handoffHash}.${Date.now()}`;
  const encoded = Buffer.from(payload).toString("base64url");
  return `${NATIVE_GOOGLE_STATE_PREFIX}${encoded}.${sign(payload)}`;
}

/** Verify a state; returns the bound handoff hash, or null if forged/expired. */
export function verifyNativeGoogleState(state: string | null | undefined): string | null {
  if (!isNativeGoogleLoginState(state)) return null;
  const parts = (state as string).slice(NATIVE_GOOGLE_STATE_PREFIX.length).split(".");
  if (parts.length !== 2) return null;
  let payload: string;
  try {
    payload = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!safeEqual(sign(payload), parts[1])) return null;
  const [handoffHash, tsStr] = payload.split(".");
  const ts = Number(tsStr);
  if (!isHandoffHash(handoffHash) || !Number.isFinite(ts)) return null;
  if (Date.now() - ts > STATE_MAX_AGE_MS || ts > Date.now() + 60_000) return null;
  return handoffHash;
}

/** 64 lowercase hex chars — the only shape a SHA-256 handoff hash can take.
 *  Validated on the way in so a junk `hs` can never reach Google as state. */
export function isHandoffHash(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

type TicketPayload = { idt: string; hs: string; exp: number };

/** Seal the Google ID token for the trip across the custom-scheme URL. */
export function sealIdTokenTicket(idToken: string, handoffHash: string): string {
  const payload: TicketPayload = {
    idt: idToken,
    hs: handoffHash,
    exp: Date.now() + TICKET_MAX_AGE_MS,
  };
  return encryptToken(JSON.stringify(payload));
}

/**
 * Unseal a ticket. Returns the ID token only when the presenter proves it holds
 * the handoff secret whose hash was bound at /start — i.e. only the webview that
 * began this sign-in. Any failure (tampered ciphertext, wrong secret, expired)
 * returns null; callers must not distinguish the cases to the client.
 */
export function openIdTokenTicket(ticket: string, handoffSecret: string): string | null {
  if (!ticket || !handoffSecret) return null;
  let payload: TicketPayload;
  try {
    payload = JSON.parse(decryptToken(ticket)) as TicketPayload;
  } catch {
    return null; // not ours, or tampered — GCM auth tag catches modification
  }
  if (!payload?.idt || !isHandoffHash(payload.hs)) return null;
  if (!Number.isFinite(payload.exp) || Date.now() > payload.exp) return null;
  if (!safeEqual(hashHandoff(handoffSecret), payload.hs)) return null;
  return payload.idt;
}
