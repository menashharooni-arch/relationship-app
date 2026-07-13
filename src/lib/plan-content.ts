// Single source of truth for the marketing plan copy — the feature lists and
// descriptions shown on BOTH the public Pricing page (/pricing) and the
// in-product plan chooser used during account creation (PlanCards, shown in the
// card wizard's plan step and on /welcome). Keeping them here guarantees the
// two screens always show the same plans, prices come from PLAN_PRICES.

export const PLAN_DESCRIPTIONS = {
  free: "Perfect to get started.",
  pro: "For serious networkers.",
  office: "For teams that share one brand.",
} as const;

export const PLAN_FEATURES = {
  free: [
    "1 digital business card",
    "5 new leads a month",
    "All 5 card templates",
    "QR code, shareable link & NFC",
    "Unlimited Swift Links buttons",
    "Save to contacts (vCard), socials, bio, address",
    "Contacts CRM: statuses, notes, read/unread",
    "Analytics: views, best day, saves & top locations",
    "Day-1 follow-up email",
    "3 AI drafts + 3 card scans a month",
    "“Powered by SwiftCard” badge",
  ],
  pro: [
    "Everything in Free, plus:",
    "Unlimited leads & contacts",
    "Unlimited cards + custom card designer",
    "No SwiftCard branding",
    "Automated follow-up sequences — email + text",
    "Unlimited AI drafts & card scans",
    "Premium Swift Links: video previews, featured tiles & themes",
    "Full analytics: who viewed, when & where",
    "CSV export + Zapier, Google & HubSpot sync",
  ],
  office: [
    "Everything in Pro, for every seat",
    "Shared office/team dashboard",
    "Individual card per member",
    "Admin seat controls & invites",
    "Unlimited seats (minimum 2)",
    "Bulk CSV import of contacts",
    "Priority support",
  ],
} as const;

export const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
