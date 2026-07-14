import { getAdminSupabase } from "@/lib/supabase-admin";
import { extractDesign, getOfficeBrand, applyBrandToUserCards, type OfficeBrand } from "@/lib/office-brand";

// ── The primary card ─────────────────────────────────────────────────────────
// The admin's original card IS the office's brand. Every employee card is based
// on it: its logo, company, website, template and look are copied onto the
// office (offices.brand_*) and from there onto every member card by the existing
// brand machinery. Employees own only their personal content.
//
// The office's contact fields (brand_phone / brand_fax / brand_address) are NOT
// derived here — an "office number" and fax aren't personal card fields, so they
// stay admin-managed on the office itself via the branding form.

// Whether this office already has a primary card. Tolerates a pre-migration
// schema (no primary_card_id column) by reporting "none".
export async function getPrimaryCardId(officeId: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("offices")
    .select("primary_card_id")
    .eq("id", officeId)
    .maybeSingle();
  if (error) return null; // column not there yet — treated as "no primary card"
  return (data?.primary_card_id as string | null) ?? null;
}

// Copy the primary card's identity + look onto the office brand, then push it to
// every member card. Safe to call repeatedly: it's a pure projection of the card.
export async function syncBrandFromPrimaryCard(officeId: string, cardId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { data: card } = await admin
    .from("cards")
    .select("logo_url, company, website, template, customization")
    .eq("id", cardId)
    .maybeSingle();
  if (!card) return;

  const cust = (card.customization as Record<string, unknown> | null) ?? {};
  const update: Record<string, unknown> = {
    brand_logo_url: (card.logo_url as string | null) ?? null,
    brand_company: (card.company as string | null) || null,
    brand_website: (card.website as string | null) || null,
    brand_template: (card.template as string | null) || null,
    brand_custom_layout: cust.customLayout ?? null,
    brand_design: extractDesign(cust),
  };

  const { error } = await admin.from("offices").update(update).eq("id", officeId);
  if (error) {
    // brand_design missing (pre office-primary-card.sql) — write what we can so
    // the office still brands correctly, just without the colour/font lock.
    delete update.brand_design;
    await admin.from("offices").update(update).eq("id", officeId);
  }

  await propagateBrandToMembers(officeId);
}

// Re-apply the office brand to every active member's cards. Called after the
// primary card changes, so employees never drift from the admin's card.
// The OWNER is skipped: their card is the source, and re-applying the brand to
// it would be a no-op at best and a feedback loop at worst.
export async function propagateBrandToMembers(officeId: string): Promise<void> {
  const admin = getAdminSupabase();
  const brand: OfficeBrand | null = await getOfficeBrand(officeId);
  if (!brand) return;

  const { data: members } = await admin
    .from("office_members")
    .select("user_id")
    .eq("office_id", officeId)
    .eq("status", "active");

  for (const m of members ?? []) {
    const uid = m.user_id as string | null;
    if (!uid) continue;
    try {
      await applyBrandToUserCards(uid, brand);
    } catch {
      // Best-effort per member — one bad card must not abort the rest. Their
      // next card edit re-applies the overlay anyway.
    }
  }
}

// Adopt `cardId` as the office's primary card when there isn't one yet, then
// sync the brand from it. Used when the admin creates their first card (seat 1).
// Returns true if this call set the primary card.
export async function ensurePrimaryCard(officeId: string, cardId: string): Promise<boolean> {
  const admin = getAdminSupabase();
  const existing = await getPrimaryCardId(officeId);
  if (existing) return false;

  const { error } = await admin
    .from("offices")
    .update({ primary_card_id: cardId })
    .eq("id", officeId)
    // Only claim the slot if it's still empty — two cards created at once must
    // not both become primary (last write would otherwise win silently).
    .is("primary_card_id", null);
  if (error) return false; // pre-migration schema — nothing to adopt into

  const now = await getPrimaryCardId(officeId);
  if (now !== cardId) return false; // lost the race — the other card is primary

  await syncBrandFromPrimaryCard(officeId, cardId);
  return true;
}

// Resolve the office a user OWNS (not merely belongs to). Only an owner's card
// can become the primary card.
export async function getOwnedOfficeId(userId: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data } = await admin.from("offices").select("id").eq("owner_id", userId).maybeSingle();
  return (data?.id as string | null) ?? null;
}

// Adopt the owner's OLDEST card as the office's primary card, if there isn't one
// yet. The office is created AFTER the admin builds their seat-1 card (and via
// the Stripe webhook / plan-change paths too), so the card can't claim the slot
// on its way in — this backfills it. Safe to call on every /office/admin load:
// it no-ops once a primary card is set.
export async function adoptPrimaryCardForOwner(officeId: string, ownerId: string): Promise<void> {
  const existing = await getPrimaryCardId(officeId);
  if (existing) return;

  const admin = getAdminSupabase();
  const { data: card } = await admin
    .from("cards")
    .select("id")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!card) return; // owner has no card yet — nothing to adopt

  await ensurePrimaryCard(officeId, card.id as string);
}
