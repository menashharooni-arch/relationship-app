// ── Lead status: the vocabulary and how it reads ────────────────────────────
//
// Split out of office-leads.ts, which also queries the database through the
// service-role client. A client component (the Leads table) imports
// leadStatusView and LEAD_STATUS_OPTIONS from here, and importing them from a
// module that reaches for getAdminSupabase put a server-only module on a path
// the browser bundle follows. The build tree-shook it, so nothing ever leaked
// — but the boundary was being held by an optimisation rather than by a rule.
//
// Pure data and pure functions. No database, no environment, nothing that
// cannot be sent to a browser.

export type LeadStatusLabel = "New" | "Contacted" | "Closed" | "Not interested";

export type LeadStatusView = {
  label: LeadStatusLabel;
  worked: boolean; // has someone on the team already handled this lead?
};

// The stored values the owner can set from the Leads tab. `status` is plain text
// with no CHECK constraint, so this needs no migration — but every value here is
// also renderable by the personal Contacts UI (LeadCard / ContactsClient), so a
// lead marked here never shows up blank there.
export const LEAD_STATUS_VALUES = ["new_contact", "touch", "dissolved", "not_interested"] as const;
export type LeadStatusValue = (typeof LEAD_STATUS_VALUES)[number];

/**
 * The stored values that mean somebody has already handled this lead.
 *
 * Derived from the same switch leadStatusView uses, so a count computed in SQL
 * and a label rendered in the UI can never disagree. Anything outside this set
 * — including null, and including a value we don't recognise — reads as New,
 * which is why the null case has to be spelled out separately in a SQL
 * `NOT IN` (SQL drops nulls from it).
 */
export const WORKED_STATUS_VALUES = ["touch", "dissolved", "not_interested"] as const;

export function isLeadStatusValue(v: string | null | undefined): v is LeadStatusValue {
  return !!v && (LEAD_STATUS_VALUES as readonly string[]).includes(v);
}

export function leadStatusView(status: string | null | undefined): LeadStatusView {
  switch ((status ?? "").toLowerCase()) {
    case "touch":
      return { label: "Contacted", worked: true };
    case "dissolved":
      return { label: "Closed", worked: true };
    case "not_interested":
      return { label: "Not interested", worked: true };
    case "new_contact":
    default:
      return { label: "New", worked: false };
  }
}

// Label → stored value, for the owner-facing status picker.
export const LEAD_STATUS_OPTIONS: { value: LeadStatusValue; label: LeadStatusLabel }[] = [
  { value: "new_contact", label: "New" },
  { value: "touch", label: "Contacted" },
  { value: "dissolved", label: "Closed" },
  { value: "not_interested", label: "Not interested" },
];
