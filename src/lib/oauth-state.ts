import { createHmac, timingSafeEqual } from "node:crypto";

// Signed OAuth `state`. Previously state was just base64url(user.id) — unsigned,
// so a valid OAuth `code` could be redeemed under an ARBITRARY user_id (an
// attacker could get their Google/HubSpot tokens written onto a victim's row,
// or bind their own account to a victim's). Signing with a server secret makes
// the user_id unforgeable, and the timestamp bounds the window.
const SECRET = process.env.OAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MAX_AGE_MS = 15 * 60 * 1000; // 15 min to complete the OAuth round trip

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** Build a signed state token binding this user_id + issue time. */
export function signState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
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
