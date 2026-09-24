import { isRateLimited } from "@/lib/rate-limit";

// ── One daily ceiling on everything an account sends through OUR senders ─────
//
// Texts and emails a user sends to their contacts go out from SwiftCard's
// shared Twilio number and connect@swiftcard.me. The per-route limits (30 texts
// per 10 min, 60 messages an hour, 60 shares an hour) stop a runaway client but
// stack to ~300 sends an hour, every hour, on a brand-new Free account — a
// real bill, and a spam relay on our sending reputation (security audit
// 2026-09-24). This is the day-long cap all three send routes share.
export const OUTBOUND_DAILY_CAP = 150;

export const OUTBOUND_CAP_MESSAGE =
  "You've reached today's sending limit. It resets within 24 hours — reach out to support if you need more.";

/** Counts one send attempt; true once the account is over today's cap. */
export async function outboundDailyCapHit(userId: string): Promise<boolean> {
  return isRateLimited(`outbound-day:${userId}`, OUTBOUND_DAILY_CAP, 24 * 60 * 60 * 1000);
}
