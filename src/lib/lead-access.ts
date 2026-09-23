// ── Lead ownership check (the single deny decision for contact access) ───────
// There is NO database RLS, so this JS check is the only thing keeping one user
// out of another user's contacts. A lead is keyed by `card_owner` (the slug of
// the card that captured it); the caller may touch it only when that slug is
// among the caller's own slugs (profile username + every card, from
// getOwnerUsernames). A missing lead, a null card_owner, or an owner slug the
// caller doesn't own all deny (the routes answer 404 so ids aren't enumerable).
// Type predicate so a `if (!ownsLead(...)) return 404` guard narrows the lead to
// non-null for the rest of the handler.
import { LOCKED_LEAD_TAG } from "@/lib/plan";

/**
 * Is this lead past the Free monthly cap (tagged sc-locked)? Its details are
 * exactly what the cap withholds: the dashboard and Contacts page filter it out
 * and leads/vcard answers "not found" for it on a Free account. Every route that
 * READS or CONTACTS a lead by id has to hold the same line, or the id alone (it
 * rides in the new-contact push link) opens the contact the list is hiding.
 * Callers pair it with the account's plan: a paid account sees every lead.
 */
export function isLockedLead(lead: { tags?: unknown } | null | undefined): boolean {
  return !!lead && Array.isArray(lead.tags) && (lead.tags as unknown[]).includes(LOCKED_LEAD_TAG);
}

export function ownsLead<T extends { card_owner?: string | null }>(
  ownerUsernames: string[],
  lead: T | null | undefined,
): lead is T {
  return !!lead && !!lead.card_owner && ownerUsernames.includes(lead.card_owner);
}
