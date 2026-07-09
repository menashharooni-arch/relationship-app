import { getAdminSupabase } from "@/lib/supabase-admin";

export type ResolvedCardMeta = {
  name: string | null;
  title: string | null;
  company: string | null;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  accentColor: string | null;
} | null;

// Resolves a public card by username the same way the card page body does:
// the cards table is the source of truth, falling back to a legacy un-migrated
// profile. Photo always comes from the owning profile. Deleted accounts → null.
// Keeps page metadata + OG/signature image in sync with the live card.
export async function resolveCardMeta(username: string): Promise<ResolvedCardMeta> {
  const admin = getAdminSupabase();

  const { data: cardRow } = await admin.from("cards").select("*").eq("username", username).maybeSingle();

  const { data: owner } = cardRow
    ? await admin.from("profiles").select("photo_url, customization").eq("id", cardRow.user_id).maybeSingle()
    : { data: null };

  const { data: profileRow } = !cardRow
    ? await admin.from("profiles").select("*").eq("username", username).maybeSingle()
    : { data: null };

  const deleted = cardRow
    ? !!(owner?.customization as { _deleted?: boolean } | null)?._deleted
    : !!(profileRow?.customization as { _deleted?: boolean } | null)?._deleted;
  if (deleted) return null;

  const legacyOk =
    !cardRow &&
    !!profileRow &&
    !((profileRow.customization as { _migrated?: boolean } | null)?._migrated) &&
    !!profileRow.name;

  const src = (cardRow ?? (legacyOk ? profileRow : null)) as Record<string, unknown> | null;
  if (!src) return null;

  const cust = (src.customization ?? {}) as { address?: string; accentColor?: string };
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? (v as string) : null);

  return {
    name: str(src.name),
    title: str(src.title),
    company: str(src.company),
    photoUrl: cardRow ? (owner?.photo_url ?? null) : (profileRow?.photo_url ?? null),
    phone: str(src.phone),
    email: str(src.email),
    website: str(src.website),
    address: str(src.address) ?? str(cust.address),
    accentColor: str(cust.accentColor) ?? "#2563eb",
  };
}
