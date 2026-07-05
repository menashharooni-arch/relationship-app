// ── Central plan configuration ──────────────────────────────────────────────
// All plan limits, the trial length, and the Pro-only design keys live here so
// nothing drifts. If you change a number, change it HERE — every route and
// component reads from this file.
export const PLAN_LIMITS = {
  FREE_CARD_LIMIT: 1,        // max cards on Free (Pro/Office: unlimited)
  FREE_CONTACT_LIMIT: 25,    // max captured contacts/leads on Free
  FREE_AI_DRAFT_LIMIT: 3,    // total AI follow-up drafts a Free user can generate (taste)
  FREE_SWIFTLINK_BUTTONS: 2, // max link buttons on Free — the SAME customization.links
                             // array powers both Swift Links buttons and card "action
                             // links", so this one cap governs both (previously the
                             // profile editor drifted to a separate 3).
  OFFICE_MIN_SEATS: 2,       // minimum seats for the Office plan
} as const;

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
  for (const key of PRO_CUSTOMIZATION_KEYS) delete cust[key];
  if (Array.isArray(cust.links) && cust.links.length > PLAN_LIMITS.FREE_SWIFTLINK_BUTTONS) {
    cust.links = (cust.links as unknown[]).slice(0, PLAN_LIMITS.FREE_SWIFTLINK_BUTTONS);
  }
  return cust as T;
}
