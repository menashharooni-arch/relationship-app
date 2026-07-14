// Single source of truth for the marketing plan copy — the feature lists and
// descriptions shown on BOTH the public Pricing page (/pricing) and the
// in-product plan chooser used during account creation (PlanCards, shown in the
// card wizard's plan step and on /welcome). Keeping them here guarantees the
// two screens always show the same plans, prices come from PLAN_PRICES.

export const PLAN_DESCRIPTIONS = {
  free: "Try it out, with limits.",
  pro: "Everything, unlimited.",
  office: "Your whole team on one brand.",
} as const;

// ── How these lists are built ────────────────────────────────────────────────
// Free used to list TWELVE features against Pro's nine, so the free plan read as
// the more generous one and Pro looked like a shorter list for $4.99. Every
// claim was true — the framing was just upside-down.
//
// The fix is framing, not gating: nothing moved between plans. Free's list now
// LEADS WITH ITS CAPS (the numbers a real user hits in week one) and states the
// badge plainly, and Pro's is one unlock per line so the value is countable.
// Never pad these to win the comparison — if a claim isn't enforced in
// PLAN_LIMITS / sanitizeCustomizationForPlan, it doesn't belong here.
export const PLAN_FEATURES = {
  free: [
    "1 digital business card",
    "5 new leads a month",
    "1 Swift Links button",
    "3 AI drafts + 3 card scans a month",
    "All 5 templates · QR, link & NFC",
    "Swift Signature — your card in every email",
    "Contacts CRM + day-1 follow-up email",
    "Basic analytics: views, saves & best day",
    "Shows a “Powered by SwiftCard” badge",
  ],
  pro: [
    "Everything in Free — with the limits taken off:",
    "Unlimited cards, leads & contacts",
    "Unlimited AI drafts & card scans",
    "Unlimited Swift Links buttons",
    "No “Powered by SwiftCard” badge — 100% your brand",
    "Custom card designer — your exact colors & fonts",
    "Automated follow-up sequences — email + text",
    "Full analytics: who viewed, when & where",
    "Premium Swift Links: video previews, featured tiles & themes",
    "CSV export + Zapier, Google & HubSpot sync",
  ],
  office: [
    "Everything in Pro, for every person",
    "One brand across every card — set it once",
    "New hires build their card in 2 minutes",
    "Team dashboard: views, leads & activity per person",
    "Every teammate's leads in one place",
    "Add or remove people anytime — your bill updates itself",
    "Admin controls: edit or switch off any card",
    "Priority support",
  ],
} as const;

export const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
