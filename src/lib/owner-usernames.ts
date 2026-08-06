import { getAdminSupabase } from "@/lib/supabase-admin";

// All usernames a user owns: their legacy profile username plus every card.
// Used to scope lead access so a user can only touch their own contacts —
// including contacts captured on their additional (non-primary) cards.
export async function getOwnerUsernames(userId: string): Promise<string[]> {
  const admin = getAdminSupabase();
  const [{ data: profile }, { data: cards }] = await Promise.all([
    admin.from("profiles").select("username").eq("id", userId).single(),
    admin.from("cards").select("username").eq("user_id", userId),
  ]);
  const names = [
    profile?.username,
    ...(cards ?? []).map((c: { username: string }) => c.username),
  ].filter(Boolean) as string[];
  // Fallback sentinel so an empty list never matches every row.
  return names.length ? names : ["__none__"];
}

/**
 * The slug to put in a PUBLIC /card/<slug> link for this user.
 *
 * Prefers their oldest card's slug, falling back to the legacy profile handle.
 * Three surfaces built these URLs straight from `profiles.username` and all
 * three 404'd: the Grow page's "Share your live card" CTA, the office team
 * drawer's View / Copy / QR actions (including a QR the admin is invited to
 * print), and the scanner's emailed card link. Modern accounts are provisioned
 * with a blank profile name and a SEPARATE card slug, so /card/<account
 * handle> is refused — while pre-migration accounts, where the two happen to
 * coincide, work fine and hide it.
 *
 * Returns null when the user has no public card at all, so callers can hide
 * the affordance rather than offer a dead one.
 */
export async function publicCardSlug(userId: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const [{ data: card }, { data: profile }] = await Promise.all([
    admin
      .from("cards")
      .select("username")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin.from("profiles").select("username").eq("id", userId).maybeSingle(),
  ]);
  return ((card?.username as string | null) || (profile?.username as string | null)) ?? null;
}
