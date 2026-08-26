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
    const { data } = await admin
      .from("cards")
      .select("username")
      .contains("customization", { _prevSlugs: [oldSlug] })
      .limit(1)
      .maybeSingle();
    return data?.username ?? null;
  } catch {
    return null;
  }
}
