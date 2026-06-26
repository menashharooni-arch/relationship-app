import { getAdminSupabase } from "@/lib/supabase-admin";

export type ResolvedCardMeta = {
  name: string | null;
  title: string | null;
  company: string | null;
  photoUrl: string | null;
} | null;

// Resolves a public card by username the same way the card page body does:
// the cards table is the source of truth, falling back to a legacy un-migrated
// profile. Photo always comes from the owning profile. Deleted accounts → null.
// Keeps page metadata + OG image in sync with the live card.
export async function resolveCardMeta(username: string): Promise<ResolvedCardMeta> {
  const admin = getAdminSupabase();

  const { data: cardRow } = await admin
    .from("cards")
    .select("name, title, company, user_id")
    .eq("username", username)
    .maybeSingle();

  const { data: owner } = cardRow
    ? await admin.from("profiles").select("photo_url, customization").eq("id", cardRow.user_id).maybeSingle()
    : { data: null };

  const { data: profileRow } = !cardRow
    ? await admin.from("profiles").select("name, title, company, photo_url, customization").eq("username", username).maybeSingle()
    : { data: null };

  const deleted = cardRow
    ? !!(owner?.customization as { _deleted?: boolean } | null)?._deleted
    : !!(profileRow?.customization as { _deleted?: boolean } | null)?._deleted;
  if (deleted) return null;

  if (cardRow) {
    return { name: cardRow.name, title: cardRow.title, company: cardRow.company, photoUrl: owner?.photo_url ?? null };
  }

  const legacyOk =
    !!profileRow &&
    !((profileRow.customization as { _migrated?: boolean } | null)?._migrated) &&
    !!profileRow.name;
  if (legacyOk && profileRow) {
    return { name: profileRow.name, title: profileRow.title, company: profileRow.company, photoUrl: profileRow.photo_url ?? null };
  }

  return null;
}
