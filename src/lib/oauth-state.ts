import { createHmac, timingSafeEqual } from "node:crypto";

// Signed OAuth `state`. Previously state was just base64url(user.id) — unsigned,
// so a valid OAuth `code` could be redeemed under an ARBITRARY user_id (an
// attacker could get their Google/HubSpot tokens written onto a victim's row,
// or bind their own account to a victim's). Signing with a server secret makes
// the user_id unforgeable, and the timestamp bounds the window.
// Key separation: OAUTH_SECRET is the only signing key. (The service-role key
// used to be a fallback — reusing an API credential as an HMAC key is a
// key-separation smell, and an EMPTY key would make state forgeable.) Fail
// closed instead: OAUTH_SECRET is set in every deployed environment.
const MAX_AGE_MS = 15 * 60 * 1000; // 15 min to complete the OAuth round trip

// Read lazily (not at module load) so the env var can be provided by the
// runtime or test setup after import.
function getSecret(): string {
  const s = process.env.OAUTH_SECRET || "";
  if (!s) throw new Error("OAUTH_SECRET missing — refusing to sign OAuth state");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/** Build a signed state token binding this user_id + issue time. */
export function signState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

// ── The native connect handoff is a DIFFERENT token ─────────────────────────
//
// In the iOS shell the OAuth connect leg runs in an SFSafariViewController,
// whose cookie jar the app's session never reaches, so the webview mints a
// short-lived token and the connect route accepts it as ?h= in place of the
// session. That token is a CREDENTIAL: presenting it starts a connect as that
// user.
//
// It used to be signState() — the very same token as the OAuth `state`. But
// `state` is not a secret: it is put in a query string and handed to Google or
// Salesforce, so it lands in browser history, in the provider's logs, and in
// any referrer along the way. Anyone holding one within its 15-minute window
// could call /api/integrations/<provider>/connect?h=<that state>, complete
// consent with THEIR OWN account, and have their tokens written onto the
// victim's integrations row — every future lead syncing to the attacker's CRM.
//
// So they are domain-separated: a distinct prefix inside the signed payload
// means an OAuth state can never be presented as a handoff token, or the
// reverse, even though both use the one signing secret. This is the same rule
// download-token.ts already states for itself and follows.
//
// Also much shorter-lived. 15 minutes exists to cover a human completing an
// OAuth round trip. A handoff is minted and redeemed inside one function —
// IntegrationsSettings POSTs for it and immediately opens the browser sheet —
// so it is seconds in practice. Five minutes rather than one, purely to absorb
// a slow cold start of SFSafariViewController on an old device.
const HANDOFF_PREFIX = "connect-handoff";
const HANDOFF_MAX_AGE_MS = 5 * 60 * 1000;

/** Mint a native connect handoff token. NOT interchangeable with signState(). */
export function signConnectHandoff(userId: string): string {
  const payload = `${HANDOFF_PREFIX}.${userId}.${Date.now()}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

/** Verify a handoff token; returns the user_id, or null. Rejects OAuth states. */
export function verifyConnectHandoff(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  let payload: string;
  try { payload = Buffer.from(parts[0], "base64url").toString("utf8"); } catch { return null; }
  const expected = sign(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(parts[1]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [prefix, userId, tsStr] = payload.split(".");
  // The prefix is what makes an OAuth state unusable here: its payload has no
  // prefix segment, so this read lands on the user id and fails the compare.
  if (prefix !== HANDOFF_PREFIX) return null;
  const ts = Number(tsStr);
  if (!userId || !Number.isFinite(ts) || Date.now() - ts > HANDOFF_MAX_AGE_MS) return null;
  return userId;
}

/** Verify a state token; returns the user_id only if the signature + age check pass. */
export function verifyState(state: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  let payload: string;
  try { payload = Buffer.from(parts[0], "base64url").toString("utf8"); } catch { return null; }
  const expected = sign(payload);
  const got = parts[1];
  // Constant-time compare (equal-length buffers).
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [userId, tsStr] = payload.split(".");
  const ts = Number(tsStr);
  if (!userId || !Number.isFinite(ts) || Date.now() - ts > MAX_AGE_MS) return null;
  return userId;
}

// ── Which BROWSER finishes the round trip ────────────────────────────────────
//
// A signed state proves WHO started a connect, not WHERE it finishes. A Pro
// account could start /api/integrations/google/connect, keep the consent URL
// (it carries their state) and send it to someone else: that person approves
// Google's real consent screen with their own account, and the callback wrote
// THEIR Google Contacts token onto the sender's row — the sender's leads then
// push into the victim's address book and overwrite matching contacts
// (security audit 2026-09-24). Salesforce was already safe: its PKCE verifier
// cookie ties the callback to the starting browser.
//
// The connect leg sets an httpOnly cookie holding an HMAC of the exact state
// it issued; the callback accepts the state only alongside that cookie. Another
// browser has no way to hold it. SameSite=Lax still sends it on the provider's
// top-level redirect back, and the iOS in-app browser keeps one cookie jar for
// both legs (the callbacks already read crm_scope / g_native / li_* from it).
export type OAuthProvider = "google" | "linkedin";

export function oauthBindCookieName(provider: OAuthProvider): string {
  return `oauth_bind_${provider}`;
}

export function oauthBindCookieValue(state: string): string {
  return sign(`bind.${state}`);
}

export const OAUTH_BIND_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: MAX_AGE_MS / 1000,
  path: "/api/integrations",
};

/** True only when `cookie` is the binding the connect leg set for `state`. */
export function stateBoundToBrowser(state: string, cookie: string | undefined | null): boolean {
  if (!cookie) return false;
  const a = Buffer.from(oauthBindCookieValue(state));
  const b = Buffer.from(cookie);
  return a.length === b.length && timingSafeEqual(a, b);
}
