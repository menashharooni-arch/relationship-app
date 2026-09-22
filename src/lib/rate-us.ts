// ── "Rate us on the App Store" — the web surfaces ────────────────────────────
//
// Three places on the web link to the App Store review form (dashboard banner,
// Settings, site footer) plus swiftcard.me/review for emails, texts and QR
// codes. The link itself is APP_STORE_WRITE_REVIEW_URL (lib/app-store.ts).
//
// Apple's rules, which every surface here follows: a plain link, always
// available, no star widget of our own, no "do you like us?" question before
// it, no reward for leaving a review. The banner only picks its MOMENT — it
// never asks how the person feels.
//
// The dashboard banner is the one surface with rules, and they live here as a
// pure function so the tests can walk them:
//
//  1. Only after a good moment: a real lead has landed, or the card has been
//     viewed RATE_US_VIEWS_NEEDED times.
//  2. Once dismissed OR clicked, gone for RATE_US_HIDE_DAYS. Stored per user in
//     Supabase (profiles.rate_us_dismissed_at), not localStorage, so it stays
//     dismissed across devices and browsers.

export const RATE_US_VIEWS_NEEDED = 5;
export const RATE_US_HIDE_DAYS = 60;
const DAY_MS = 86_400_000;

export type RateUsState = {
  /** Real leads (the "demo" sample contact excluded). */
  leadCount: number;
  /** Card + Swift Links views. */
  viewCount: number;
  /** ISO time the banner was last dismissed or clicked, or null. */
  dismissedAt: string | null;
};

export function shouldShowRateUsBanner(s: RateUsState, now: number = Date.now()): boolean {
  if (s.leadCount < 1 && s.viewCount < RATE_US_VIEWS_NEEDED) return false;
  if (s.dismissedAt) {
    const t = new Date(s.dismissedAt).getTime();
    if (Number.isFinite(t) && now - t < RATE_US_HIDE_DAYS * DAY_MS) return false;
  }
  return true;
}
