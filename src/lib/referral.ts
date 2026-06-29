// ── Central referral & free-month configuration ─────────────────────────────
// CHANGE THE NUMBERS HERE. Everything else reads from this file.

export const REFERRAL = {
  // A new user who arrives via any promo/referral gets this many free months of Pro.
  NEW_USER_FREE_MONTHS: 1,
  // A referrer earns this many free months when their friend becomes a PAYING customer.
  REFERRER_FREE_MONTHS: 1,
  // A referrer can earn the reward only ONCE, ever — no matter how many they refer.
  REFERRER_REWARD_ONCE: true,
  // Length of one "month" of a free grant, in days.
  DAYS_PER_FREE_MONTH: 30,
} as const;

export function freeMonthDays(months: number): number {
  return Math.round(months * REFERRAL.DAYS_PER_FREE_MONTH);
}

// ── Signup attribution ──────────────────────────────────────────────────────
// Where a new signup came from. Drives admin analytics + which sources grant a
// free month. "direct" = organic (no promo, no free month).
export const SIGNUP_SOURCES = [
  "referral",      // a real referral link /r/CODE (has a referrer who can earn a reward)
  "save_contact",  // popup after saving someone's contact (no referrer)
  "share_info",    // popup after submitting the "share your info" form (no referrer)
  "vcard",         // after downloading a vCard
  "link_button",   // after tapping a Swift Links button
  "badge",         // "Made with SwiftCard" badge
  "follow_up",     // "Sent with SwiftCard" link in an automation email/text
  "direct",        // organic
] as const;
export type SignupSource = (typeof SIGNUP_SOURCES)[number];

export function isSignupSource(s: string | null | undefined): s is SignupSource {
  return !!s && (SIGNUP_SOURCES as readonly string[]).includes(s);
}

// Every promo source grants the new user a free month; only plain "direct" doesn't.
export function sourceGrantsFreeMonth(src: string | null | undefined): boolean {
  return isSignupSource(src) && src !== "direct";
}

// ── Shared nudge copy ───────────────────────────────────────────────────────
// One place for all the "create your own SwiftCard" wording. Keyed by source.
type NudgeCopy = { title: string; sub: string; cta: string };
const FREE = "Get 1 month of Pro free";

export const NUDGE_COPY: Record<string, NudgeCopy> = {
  default:      { title: "Create your own SwiftCard", sub: `${FREE} when you start today.`, cta: "Get 1 month free" },
  save_contact: { title: "Create your own SwiftCard", sub: `${FREE} — your card, your way.`, cta: "Get 1 month free" },
  share_info:   { title: "Create your own SwiftCard", sub: `${FREE} when you start today.`, cta: "Get 1 month free" },
  vcard:        { title: "Saved ✓ Now make your own", sub: `${FREE} on your own SwiftCard.`, cta: "Make my card free" },
  link_button:  { title: "Get a page like this, free", sub: `Your own Swift Links + card. ${FREE}.`, cta: "Get started free" },
  badge:        { title: "Create your own SwiftCard", sub: `${FREE} when you start today.`, cta: "Get 1 month free" },
  follow_up:    { title: "Create your own SwiftCard", sub: `${FREE} when you start today.`, cta: "Get 1 month free" },
};

export function nudgeCopy(source: string | null | undefined): NudgeCopy {
  return (source && NUDGE_COPY[source]) || NUDGE_COPY.default;
}

// Cookie names used to carry a referral/promo through the signup flow.
export const REF_COOKIE = "sc_ref";      // referral code (has a referrer)
export const SRC_COOKIE = "sc_src";      // signup source (attribution + free month)
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
