// ── Central plan configuration ──────────────────────────────────────────────
// All plan limits live here so they're easy to change in one place.
export const PLAN_LIMITS = {
  FREE_CARD_LIMIT: 1,        // max cards on Free (Pro/Office: unlimited)
  FREE_CONTACT_LIMIT: 25,    // max captured contacts/leads on Free
  FREE_AI_DRAFT_LIMIT: 3,    // total AI follow-up drafts a Free user can generate (taste)
  FREE_SWIFTLINK_BUTTONS: 2, // max Swift Links action buttons shown/saved on Free
  OFFICE_MIN_SEATS: 2,       // minimum seats for the Office plan
} as const;

// A paid plan = Pro or Office (enterprise). Office is a superset of Pro.
export function isPaidPlan(plan?: string | null): boolean {
  return plan === "pro" || plan === "enterprise";
}

export function isOfficePlan(plan?: string | null): boolean {
  return plan === "enterprise";
}
