import { getAdminSupabase } from "@/lib/supabase-admin";

// The 2026-08-26 slug-format migration renamed every auto-generated card slug
// ("aaron-lavi-malve-capital" → "aaronlavi-malvecapital") and left the OLD
// slug behind in the card's customization._prevSlugs. Shared links, printed QR
// codes and installed email signatures still point at the old slug — this
// resolves it so those land on the live card instead of a 404.
export async function findSlugAlias(oldSlug: string): Promise<string | null> {
  if (!oldSlug) return null;
  try {
    const admin = getAdminSupabase();
    // Oldest first: an address belongs to the card that had it first. With
    // no order, two rows carrying the same old slug resolved to whichever the
    // database happened to return.
    const { data } = await admin
      .from("cards")
      .select("username")
      .contains("customization", { _prevSlugs: [oldSlug] })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return data?.username ?? null;
  } catch {
    return null;
  }
}

/**
 * Is this slug still an OLD address of some card — kept as a redirect in
 * customization._prevSlugs — owned by anyone other than `exceptUserId`?
 *
 * A card's former address keeps redirecting to it, because printed QR codes,
 * NFC tags, shared links and Wallet passes still point there. Handing that
 * address to a NEW card (another "John Smith / Acme", or a hand-picked URL)
 * would send all of those to a stranger's card. Fails CLOSED: if the lookup
 * errors, the slug counts as held and the caller picks another.
 */
export async function slugHeldAsAlias(
  admin: ReturnType<typeof getAdminSupabase>,
  slug: string,
  exceptUserId?: string,
): Promise<boolean> {
  if (!slug) return false;
  try {
    let q = admin
      .from("cards")
      .select("id")
      .contains("customization", { _prevSlugs: [slug] })
      .limit(1);
    if (exceptUserId) q = q.neq("user_id", exceptUserId);
    const { data, error } = await q.maybeSingle();
    if (error) return true;
    return !!data;
  } catch {
    return true;
  }
}
