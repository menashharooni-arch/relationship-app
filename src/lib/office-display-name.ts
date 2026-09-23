import { getAdminSupabase } from "@/lib/supabase-admin";

// ── The company name an invitee will recognise ──────────────────────────────
// One ladder for every surface an invited teammate reads before they are on
// the team — the invite email, the /join page, the dashboard "you're invited"
// banner. They used to disagree: the email walked Branding → the owner's card
// → the stored name, while the join page printed offices.name raw, so the
// same person read "Meridian Bank" in their inbox and "Create your My Office
// card" one tap later.
//
// offices.name is a machine default more often than not: "My Office" when the
// owner had no company anywhere, "<Name>'s Team" when their card had a name
// but no company (lib/office-billing-sync). Neither is a company, and both
// read wrong in a sentence ("added you to the My Office team", "create your
// Dana Smith's Team card") — so they count as "no name", and every caller has
// wording for that case instead of a placeholder.

export function isPlaceholderOfficeName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  return !n || n === "My Office" || /'s Team$/i.test(n);
}

/** The real company name for an office, or null when none is known. */
export async function officeCompanyName(
  officeId: string | null | undefined,
  known?: { brandCompany?: string | null; storedName?: string | null; ownerId?: string | null },
): Promise<string | null> {
  if (!officeId) return null;
  const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  try {
    const admin = getAdminSupabase();
    let brandCompany = known && "brandCompany" in known ? clean(known.brandCompany) : undefined;
    let storedName = known && "storedName" in known ? clean(known.storedName) : undefined;
    let ownerId = known?.ownerId ?? null;
    if (brandCompany === undefined || storedName === undefined || !ownerId) {
      const { data: office } = await admin
        .from("offices")
        .select("name, owner_id, brand_company")
        .eq("id", officeId)
        .maybeSingle();
      if (brandCompany === undefined) brandCompany = clean(office?.brand_company);
      if (storedName === undefined) storedName = clean(office?.name);
      ownerId ??= (office?.owner_id as string | null) ?? null;
    }
    if (brandCompany) return brandCompany;
    if (ownerId) {
      const { data: card } = await admin
        .from("cards")
        .select("company")
        .eq("user_id", ownerId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const cardCompany = clean(card?.company);
      if (cardCompany) return cardCompany;
    }
    return isPlaceholderOfficeName(storedName) ? null : storedName!;
  } catch {
    return null;
  }
}
