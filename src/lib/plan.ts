// ── Central plan configuration ──────────────────────────────────────────────
// All plan limits, the trial length, and the Pro-only design keys live here so
// nothing drifts. If you change a number, change it HERE — every route and
// component reads from this file.
export const PLAN_LIMITS = {
  FREE_CARD_LIMIT: 1,          // max cards on Free (Pro/Office: unlimited)
  // ── Monthly free meters (refresh on the 1st; counted per-ACCOUNT via
  //    profiles.customization._usage so deleting a card can never reset them).
  FREE_LEADS_PER_MONTH: 5,     // new leads/month before extras soft-lock behind Pro
  FREE_SCANS_PER_MONTH: 3,     // AI business-card scans/month (a taste of the scanner)
  FREE_AI_DRAFTS_PER_MONTH: 3, // AI follow-up drafts/month
  OFFICE_MIN_SEATS: 2,         // minimum seats for the Office plan
} as const;

// Displayed prices on /pricing, in cents (USD) — the ONE source of truth for
// what SwiftCard charges. The checkout route fetches the actual Stripe Price
// object for whatever priceId is requested and refuses to check out if its
// unit_amount doesn't match here, so a mispriced Stripe Product can never
// silently charge someone something different from what they saw on the page.
// Change a number here AND in Stripe's dashboard together — never one without the other.
export const PLAN_PRICES = {
  PRO_MONTHLY_CENTS: 499,               // $4.99/mo
  PRO_ANNUAL_CENTS: 5400,                // $54.00/yr (~$4.50/mo, 10% off monthly)
  OFFICE_MONTHLY_PER_SEAT_CENTS: 399,    // $3.99/mo per seat
  OFFICE_ANNUAL_PER_SEAT_CENTS: 4309,    // $43.09/yr per seat (399 * 12 * 0.9, 10% off)
} as const;

// Internal lead tag: a lead captured beyond the free monthly cap. Stored on the
// lead, hidden from the owner (blurred) until they upgrade — never deleted, and
// unlocked automatically the moment the account is paid.
export const LOCKED_LEAD_TAG = "sc-locked";

// Every NEW signup gets a full-Pro reverse trial for this many days, then the
// daily cron downgrades them to Free (never touches a real paying subscriber).
export const TRIAL_DAYS = 14;

// Length of one app-level "free month" grant, in days (referral/promo rewards).
export const FREE_MONTH_DAYS = 30;

// Customization keys that are Pro-only design controls. Stripped server-side for
// non-paid accounts so a downgraded or hand-crafted request can't keep them.
// (Free baseline customization — about, address, bio, socials, testimonials,
// links up to the cap — is never touched.)
export const PRO_CUSTOMIZATION_KEYS = ["accentColor", "font"] as const;

// A paid plan = Pro or Office (enterprise). Office is a superset of Pro.
export function isPaidPlan(plan?: string | null): boolean {
  return plan === "pro" || plan === "enterprise";
}

export function isOfficePlan(plan?: string | null): boolean {
  return plan === "enterprise";
}

// Enforce Free limits on a card's customization blob: strip Pro-only design keys
// and cap link buttons. Returns a NEW object; never mutates the input. Paid
// accounts pass through untouched.
export function sanitizeCustomizationForPlan<T extends Record<string, unknown>>(
  customization: T | null | undefined,
  paid: boolean,
): T {
  const cust = { ...(customization ?? {}) } as Record<string, unknown>;
  if (paid) return cust as T;
  // Free now gets UNLIMITED Swift Links / action-link buttons (matches the plan
  // sheet). Pro is differentiated by presentation (custom theme colors/fonts,
  // video previews, featured tiles) — so we still strip the Pro-only design keys.
  for (const key of PRO_CUSTOMIZATION_KEYS) delete cust[key];
  return cust as T;
}
