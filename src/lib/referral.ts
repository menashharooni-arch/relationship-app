// ── Central referral & free-month configuration ─────────────────────────────
// CHANGE THE NUMBERS HERE. Everything else reads from this file.

export const REFERRAL = {
  // A new user who arrives via a referral link gets this many free months of Pro.
  NEW_USER_FREE_MONTHS: 1,
  // ── Referrer rewards (signup-count based) ──────────────────────────────────
  // Every SIGNUPS_PER_REWARD successful signups through a user's link unlocks
  // one CLAIMABLE free month of Pro. The user must explicitly tap "claim" to
  // activate it (notification or the Refer-a-friend box in Settings).
  SIGNUPS_PER_REWARD: 3,
  // Months granted per completed batch of signups.
  REFERRER_FREE_MONTHS: 1,
  // Lifetime cap on referral months a user can earn (3 months = 9 signups).
  MAX_REFERRAL_REWARDS: 3,
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
  "preview",       // a "Create Your Card for Free" button on the Test It Live page
  "direct",        // organic
] as const;
export type SignupSource = (typeof SIGNUP_SOURCES)[number];

export function isSignupSource(s: string | null | undefined): s is SignupSource {
  return !!s && (SIGNUP_SOURCES as readonly string[]).includes(s);
}

// Only a real referral (a friend sharing their /r/CODE link) grants a free month.
// All other prompts — save_contact, share_info, badge, follow_up, etc. — are plain
// "create a free account" CTAs with no free month.
export function sourceGrantsFreeMonth(src: string | null | undefined): boolean {
  return src === "referral";
}

// ── Shared nudge copy ───────────────────────────────────────────────────────
// One place for all the "create your own SwiftCard" wording. Keyed by source.
type NudgeCopy = { title: string; sub: string; cta: string };

// The CTA takes visitors to the Test It Live demo (/join?to=live → /preview),
// so the button promises the card, and the demo closes the sale.
// Copy rides the moment the visitor JUST had: they saved/received a card in one
// tap and it felt effortless — the headline turns that feeling into "I want
// that for me". "My" in the CTA (not "your") is the classic CRO ownership win.
export const NUDGE_COPY: Record<string, NudgeCopy> = {
  default:      { title: "Look this good when you network", sub: "Your own tap-to-share card — stunning, smart, live in 60 seconds.", cta: "Create my free card" },
  save_contact: { title: "Next time, be the one they save", sub: "One tap and you're in their phone — card, links, everything.", cta: "Create my free card" },
  share_info:   { title: "Never type your info again", sub: "One tap shares who you are — your card, your links, your brand.", cta: "Create my free card" },
  vcard:        { title: "Saved in one tap. That could be you", sub: "Your own SwiftCard — in their phone before the handshake ends.", cta: "Create my free card" },
  link_button:  { title: "One link for everything you are", sub: "Your links + a smart business card in one beautiful page.", cta: "Create my free card" },
  badge:        { title: "Look this good when you network", sub: "Your own tap-to-share card — stunning, smart, live in 60 seconds.", cta: "Create my free card" },
  follow_up:    { title: "Look this good when you network", sub: "Your own tap-to-share card — stunning, smart, live in 60 seconds.", cta: "Create my free card" },
};

export function nudgeCopy(source: string | null | undefined): NudgeCopy {
  return (source && NUDGE_COPY[source]) || NUDGE_COPY.default;
}

// Cookie names used to carry a referral/promo through the signup flow.
export const REF_COOKIE = "sc_ref";      // referral code (has a referrer)
export const SRC_COOKIE = "sc_src";      // signup source (attribution + free month)
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
