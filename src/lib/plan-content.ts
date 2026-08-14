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
    "2 additional links on your Swift Links page",
    "3 AI follow-up drafts a month",
    "All 6 templates · QR, link & NFC",
    "Swift Signature — your card in every email",
    // Was "Contacts CRM + day-1 follow-up email". Nothing sends that: the only
    // automated sender is hard-gated on isPaidPlan (reminders route), and no
    // default sequence is seeded when a lead is captured — so a Free user was
    // promised an automated follow-up they would never receive, on /pricing,
    // the in-product plan chooser, the admin plan matrix and the support
    // chatbot. This file's own rule is that unenforced claims don't belong in
    // it.
    "Contacts CRM to track every connection",
    "One-tap “Share my info” back to any contact",
    "Basic analytics: views, saves & best day",
    // Name only. The badge renders as "Made with SwiftCard" on both the card
    // and the Swift Links footer, so calling it something else here sent people
    // looking for a badge that does not exist under that name.
    // NOTE: this line's OTHER problem is untouched and still open — 532a660 put
    // the badge on every card on every plan, so listing it as a Free-tier trait
    // (and Pro's "No SwiftCard branding anywhere" below) no longer matches what
    // ships. That is a pricing decision, not a rename.
    "Shows a “Made with SwiftCard” badge",
  ],
  pro: [
    "Everything in Free — with the limits taken off:",
    "Unlimited cards, leads & contacts",
    "Unlimited AI follow-up drafts",
    "Scan any business card — AI fills the contact in",
    "Unlimited additional links on Swift Links",
    "Social design — style your Swift Links page: backgrounds, colors & fonts",
    // "your exact colors & fonts" described what the FREE templates already do,
    // and undersold the thing being charged for. The designer's actual claim is
    // that a template is a starting point rather than a fixed choice.
    "Custom card designer — eight Pro-only looks, or scan your printed card and we'll rebuild it",
    "No SwiftCard branding anywhere — emails, texts & pages are 100% your brand",
    "Automated follow-up sequences — email + text",
    "Full analytics: who viewed, when & where",
    "Premium Swift Links: video previews & featured tiles",
    "CRM sync: GoHighLevel, Pipedrive, HubSpot, Google + Zapier & CSV",
  ],
  office: [
    "Everything in Pro, for every person",
    "One brand across every card — logo, contact info & design, set once",
    "Lock the card design so every card stays on-brand",
    "Passwordless invites — new hires sign in with Google or an email link and build their card in 2 minutes",
    "Team dashboard: views, leads & activity per person",
    "Every teammate's leads in one place — each account stays private to them",
    "Add or remove people anytime — your bill updates itself",
    "Admin controls: edit or switch off any card",
    "Priority support",
  ],
} as const;

export const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
