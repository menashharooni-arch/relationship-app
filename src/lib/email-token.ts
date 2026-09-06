import { createHmac, timingSafeEqual } from "node:crypto";

// ── Signed link into the email preference centre ─────────────────────────────
//
// A marketing footer has to reach the preference page with NO LOGIN — a person
// reading mail on a phone at 7am will not sign in to stop receiving it, they
// will press the spam button, and that costs the whole domain. So the link
// carries a token that identifies the account on its own.
//
// Shape: base64url(userId).base64url(expiryUnixSeconds).signature
//
// The expiry is INSIDE the signed payload, not a separate query param, so it
// cannot be extended by editing the URL. 90 days, because a marketing email can
// sit unread for months and a dead preference link means the only remaining
// exit is the spam button.
//
// Signed with the same server secret as every other unguessable link we mint
// (OAUTH_SECRET / CRON_SECRET, see lib/messaging.ts). FAIL CLOSED: with no
// secret we refuse to SIGN, rather than signing with a constant that would let
// anyone forge an opt-out for any account. Verification degrades to "invalid"
// instead of throwing, so a misconfigured deploy shows an error page rather
// than 500ing the one-click endpoint — a 500 reads to Gmail as a broken
// unsubscribe, which is worse than advertising none.

const TTL_DAYS = 90;
export const EMAIL_TOKEN_TTL_DAYS = TTL_DAYS;

function secret(): string {
  const s = process.env.OAUTH_SECRET || process.env.CRON_SECRET || "";
  if (!s) throw new Error("OAUTH_SECRET/CRON_SECRET missing — refusing to sign email preference tokens");
  return s;
}

const b64 = (v: string) => Buffer.from(v).toString("base64url");
const unb64 = (v: string) => Buffer.from(v, "base64url").toString("utf8");

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(`emailprefs:${payload}`).digest("base64url");
}

/** A preference-centre token for this account. Throws if the server has no secret. */
export function signEmailToken(userId: string, now: number = Date.now()): string {
  const exp = Math.floor(now / 1000) + TTL_DAYS * 86400;
  const payload = `${b64(userId)}.${b64(String(exp))}`;
  return `${payload}.${sign(payload)}`;
}

/** The full URL a marketing footer links to. Undefined when it cannot be signed. */
export function preferenceCenterUrl(userId: string): string | undefined {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";
    return `${appUrl}/email/preferences?t=${encodeURIComponent(signEmailToken(userId))}`;
  } catch {
    return undefined;
  }
}

export type TokenResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "unconfigured" };

/**
 * Verify a token. Never throws.
 *
 * The signature is checked BEFORE the expiry, and both are checked before the
 * user id is trusted for anything — an attacker must not be able to learn
 * whether an id exists by watching which error comes back. All failures return
 * the same 404-shaped answer at the route layer.
 */
export function verifyEmailToken(token: string | null | undefined, now: number = Date.now()): TokenResult {
  const raw = (token ?? "").trim();
  if (!raw) return { ok: false, reason: "malformed" };

  const parts = raw.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [idPart, expPart, sig] = parts;
  const payload = `${idPart}.${expPart}`;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return { ok: false, reason: "unconfigured" };
  }

  // Length-guarded: timingSafeEqual throws on a length mismatch, and a throw
  // here would be a 500 on the one-click path.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };

  const exp = Number(unb64(expPart));
  if (!Number.isFinite(exp)) return { ok: false, reason: "malformed" };
  if (exp * 1000 <= now) return { ok: false, reason: "expired" };

  const userId = unb64(idPart);
  if (!userId) return { ok: false, reason: "malformed" };
  return { ok: true, userId };
}
