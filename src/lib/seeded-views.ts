// ── Seeded demo views are not real traffic ───────────────────────────────────
//
// scripts/create-apple-review-account.js populates the App Review account with
// a month of synthetic card views so a reviewer opening the dashboard sees a
// working product instead of an empty state. That is deliberate and must stay.
//
// But those rows live in the SAME card_views table as real traffic, and the
// site-wide admin metrics counted them: 24 of 81 rows, so roughly 30% of the
// total view count was invented. Customer dashboards were never affected —
// each filters by its own card slug — but the numbers WE read to judge whether
// the product is working were inflated by a third.
//
// Identified by the visitor id the seeder writes ("demo-visitor-0" … "-8")
// rather than by the account slug: the marker travels with the rows, so it
// still holds if the review account is renamed or a second demo account is
// seeded later.
export const SEEDED_VISITOR_PREFIX = "demo-visitor";

/** True for a synthetic view planted for the App Review demo account. */
export function isSeededView(visitorId: string | null | undefined): boolean {
  return (visitorId ?? "").startsWith(SEEDED_VISITOR_PREFIX);
}
