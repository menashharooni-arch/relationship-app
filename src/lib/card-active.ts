import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS, isPaidPlan } from "@/lib/plan";

// ── Central "is this card allowed to be public?" kill-switch ────────────────
// EVERY public surface (card page, Swift Links, OG/share image, Apple Wallet
// pass, lead capture, vCard) must consult this so there is no bypass:
//
//   1. DELETED account  → every card, link, QR, signature link, and wallet
//      pass of that account is inactive.
//   2. DELETED card     → the row is gone; nothing resolves (handled by the
//      lookups themselves).
//   3. DOWNGRADED plan  → a Free account only serves its FIRST card(s)
//      (oldest, up to FREE_CARD_LIMIT). Extra cards created on Pro go
//      inactive the moment the plan is no longer paid — links, QRs, NFC
//      tags, wallet passes and lead capture for them all stop working.
//      Their remaining Free-plan card's links keep working.
//   4. TAKEN OFFLINE    → an office admin pulled the card from /office/admin.
//      Everything the card serves goes dark, but nothing is deleted, so it can
//      be brought back online. Used when an employee leaves.

export function ownerIsDeleted(customization: unknown): boolean {
  return !!(customization as { _deleted?: boolean } | null)?._deleted;
}

// Whether an office admin has taken this card offline. A missing column
// (pre office-primary-card.sql) reads as undefined → the card stays live.
export function cardIsOffline(cardRow: unknown): boolean {
  return (cardRow as { is_offline?: boolean } | null)?.is_offline === true;
}

// Whether this card falls within its owner's plan allowance. Cheap: only
// queries when the owner is NOT paid.
export async function cardWithinPlanLimit(
  cardId: string,
  userId: string,
  plan: string | null | undefined
): Promise<boolean> {
  if (isPaidPlan(plan)) return true;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("cards")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(PLAN_LIMITS.FREE_CARD_LIMIT);
  return (data ?? []).some((c: { id: string }) => c.id === cardId);
}

// One-call resolver for API routes: is the card slug live right now?
// (Legacy profile-cards count as the account's primary card — always within
// the Free allowance.)
export async function isCardActive(username: string): Promise<boolean> {
  const admin = getAdminSupabase();
  // select("*") so is_offline is picked up when present and simply absent on a
  // pre-migration schema (an explicit column list would error there instead).
  const { data: cardRow } = await admin
    .from("cards")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (cardRow) {
    if (cardIsOffline(cardRow)) return false;
    const { data: owner } = await admin
      .from("profiles")
      .select("plan, customization")
      .eq("id", cardRow.user_id)
      .maybeSingle();
    if (!owner || ownerIsDeleted(owner.customization)) return false;
    return cardWithinPlanLimit(cardRow.id, cardRow.user_id, owner.plan);
  }

  const { data: profileRow } = await admin
    .from("profiles")
    .select("name, customization")
    .eq("username", username)
    .maybeSingle();
  if (!profileRow || ownerIsDeleted(profileRow.customization)) return false;
  const cust = profileRow.customization as { _migrated?: boolean } | null;
  return !cust?._migrated && !!profileRow.name; // legacy un-migrated profile-card
}
