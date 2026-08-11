import { createHmac, timingSafeEqual } from "node:crypto";

// ── Short-lived download tokens ──────────────────────────────────────────────
//
// THE BUG THIS EXISTS FOR. Authenticated downloads were dead in the iOS app.
// native-file.ts hands the URL to @capacitor/browser (SFSafariViewController),
// which uses SAFARI's cookie jar — the Capacitor WKWebView has its own, and the
// Supabase session cookie does not cross that boundary. So "Export CSV" and
// "Save to phone" opened a Safari sheet showing {"error":"Unauthorized"} or the
// login page. Worse than a dead button: it looks like the account is broken.
// (The two PUBLIC downloads routed the same way — a card's vCard, the Wallet
// pass — were always fine, which is why this went unnoticed.)
//
// The fix has to carry proof of identity IN THE URL, because the URL is all
// that crosses into the other browser. This token is that proof:
//
//   • bound to ONE user id, so it cannot fetch anyone else's data
//   • bound to ONE exact path, so an export token cannot be replayed against a
//     different endpoint
//   • 60 seconds, because it is minted on tap and redeemed immediately
//
// Deliberately NOT reusing signState(): that carries only a user id with a
// 15-minute window, so an OAuth state could be replayed as a download token for
// any route. Different purpose, different payload, different lifetime.
//
// The alternative was @capacitor/filesystem + Share (fetch in the webview where
// the cookie lives, write, then share). That is the canonical Capacitor
// download pattern, but it adds a native plugin — so it would not reach a
// single installed phone until a new TestFlight build ships and is approved.
// This is pure web and fixes every build already on a device.

const MAX_AGE_MS = 60 * 1000;

function getSecret(): string {
  const s = process.env.OAUTH_SECRET || "";
  if (!s) throw new Error("OAUTH_SECRET missing — refusing to sign a download token");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/**
 * The only paths a token may be minted for.
 *
 * An allowlist rather than "whatever the client asked for": without it the
 * mint endpoint would sign a token for any path a caller names, which is a
 * confused-deputy hole the moment a future route trusts these tokens.
 */
export const DOWNLOADABLE_PATHS = [
  "/api/leads/export",
  "/api/leads/vcard",
  "/api/office/analytics/export",
] as const;

export type DownloadablePath = (typeof DOWNLOADABLE_PATHS)[number];

export function isDownloadablePath(p: string): p is DownloadablePath {
  return (DOWNLOADABLE_PATHS as readonly string[]).includes(p);
}

/** Sign a token authorising `userId` to fetch `path` for the next 60 seconds. */
export function signDownloadToken(userId: string, path: DownloadablePath): string {
  const payload = `${userId}|${path}|${Date.now()}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

/**
 * Verify a token against the path being served. Returns the user id only when
 * the signature, the path binding and the age all check out.
 *
 * `path` is supplied by the ROUTE, never by the request, so a token minted for
 * one endpoint cannot be spent at another.
 */
export function verifyDownloadToken(token: string, path: DownloadablePath): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  let payload: string;
  try {
    payload = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }
  const a = Buffer.from(sign(payload));
  const b = Buffer.from(parts[1]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [userId, signedPath, tsStr] = payload.split("|");
  const ts = Number(tsStr);
  if (!userId || signedPath !== path) return null;
  if (!Number.isFinite(ts) || Date.now() - ts > MAX_AGE_MS) return null;
  return userId;
}
