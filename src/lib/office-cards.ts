import { getAdminSupabase } from "@/lib/supabase-admin";

// ── Which cards does an office actually control? ─────────────────────────────
// The office admin may only ever touch cards owned by the office's OWNER or by
// its ACTIVE members. This resolver is the single gate for that — every office
// card route goes through it, so a card id from another office (or a stranger's
// card id pasted into the URL) can never be read or written.

export type OfficeCard = {
  id: string;
  user_id: string;
  username: string;
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  /** The card's nickname — what the admin sees in a list of many cards. */
  label: string | null;
  template: string | null;
  logo_url: string | null;
  is_offline: boolean;
  created_at: string | null;
  // Who owns it, for the admin's list.
  ownerEmail: string | null;
  ownerName: string | null;
  isPrimary: boolean;
};

// Every user id whose cards this office controls: the owner + active members.
export async function getOfficeUserIds(officeId: string): Promise<string[]> {
  const admin = getAdminSupabase();
  const ids: string[] = [];

  const { data: office } = await admin.from("offices").select("owner_id").eq("id", officeId).maybeSingle();
  if (office?.owner_id) ids.push(office.owner_id as string);

  const { data: members } = await admin
    .from("office_members")
    .select("user_id")
    .eq("office_id", officeId)
    .eq("status", "active");
  for (const m of members ?? []) {
    const uid = m.user_id as string | null;
    if (uid && !ids.includes(uid)) ids.push(uid);
  }
  return ids;
}

// True when `cardId` belongs to someone this office controls. The authorization
// gate for the per-card admin routes.
export async function officeOwnsCard(officeId: string, cardId: string): Promise<boolean> {
  const admin = getAdminSupabase();
  const { data: card } = await admin.from("cards").select("user_id").eq("id", cardId).maybeSingle();
  if (!card) return false;
  const ids = await getOfficeUserIds(officeId);
  return ids.includes(card.user_id as string);
}

// Every card in the office, annotated with its owner and whether it's primary.
export async function listOfficeCards(officeId: string): Promise<OfficeCard[]> {
  const admin = getAdminSupabase();
  const userIds = await getOfficeUserIds(officeId);
  if (!userIds.length) return [];

  // is_offline may not exist yet (pre office-primary-card.sql) — fall back to
  // the base columns and treat every card as live.
  let cards: Record<string, unknown>[] | null = null;
  {
    const { data } = await admin
      .from("cards")
      .select("id, user_id, username, name, title, email, phone, template, logo_url, created_at, label, is_offline")
      .in("user_id", userIds)
      .order("created_at", { ascending: true });
    cards = data as Record<string, unknown>[] | null;
  }
  if (!cards) {
    const { data } = await admin
      .from("cards")
      .select("id, user_id, username, name, title, email, phone, template, logo_url, created_at, label")
      .in("user_id", userIds)
      .order("created_at", { ascending: true });
    cards = data as Record<string, unknown>[] | null;
  }
  if (!cards?.length) return [];

  const { data: profiles } = await admin.from("profiles").select("id, email, name").in("id", userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  const { data: office } = await admin.from("offices").select("primary_card_id").eq("id", officeId).maybeSingle();
  const primaryId = (office?.primary_card_id as string | null) ?? null;

  return cards.map((c) => {
    const prof = byId.get(c.user_id as string);
    return {
      id: c.id as string,
      user_id: c.user_id as string,
      username: c.username as string,
      name: (c.name as string | null) ?? null,
      title: (c.title as string | null) ?? null,
      email: (c.email as string | null) ?? null,
      phone: (c.phone as string | null) ?? null,
      label: (c.label as string | null) ?? null,
      template: (c.template as string | null) ?? null,
      logo_url: (c.logo_url as string | null) ?? null,
      is_offline: c.is_offline === true,
      created_at: (c.created_at as string | null) ?? null,
      ownerEmail: (prof?.email as string | null) ?? null,
      ownerName: (prof?.name as string | null) ?? null,
      isPrimary: !!primaryId && primaryId === c.id,
    };
  });
}
