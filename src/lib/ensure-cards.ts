import { getAdminSupabase } from "@/lib/supabase-admin";

// Card-content columns that move from the legacy "primary card" (the profiles row)
// into the cards table. Account-only columns (plan, billing, flow_settings, photo_url,
// referral username) stay on the profile.
const CARD_FIELDS = [
  "username", "name", "title", "company", "phone", "email", "website",
  "linkedin", "instagram", "twitter", "tiktok", "template", "customization", "logo_url",
];

/**
 * One-time, idempotent migration toward the "account ≠ cards" model.
 *
 * Older accounts stored their first card directly in the profiles row (the
 * "primary card"). This copies that card into the cards table so every card lives
 * in one place, then marks the profile as migrated so it never runs again — which
 * also means a card the user later deletes is NOT re-created. Purely additive: it
 * never deletes profile data.
 */
export async function ensureUserCards(userId: string, prefetchedProfile?: Record<string, unknown>): Promise<void> {
  const admin = getAdminSupabase();

  // Callers that already hold the profile row pass it in — saves a round trip
  // on every dashboard load (this runs on each visit but is a no-op once migrated).
  let profile = prefetchedProfile ?? null;
  if (!profile) {
    const { data } = await admin.from("profiles").select("*").eq("id", userId).single();
    profile = (data as Record<string, unknown>) ?? null;
  }
  if (!profile) return;

  const p = profile as Record<string, unknown>;
  const customization = (p.customization as Record<string, unknown> | null) ?? {};

  // Already handled — never re-create a card the user has since deleted.
  if (customization._migrated) return;

  const username = (p.username as string) || "";
  const name = (p.name as string) || "";

  // Account-only profile (new signup) — nothing to migrate.
  if (!username || !name) return;

  const { data: existing } = await admin
    .from("cards")
    .select("id")
    .eq("user_id", userId)
    .eq("username", username)
    .maybeSingle();

  if (!existing) {
    const row: Record<string, unknown> = { user_id: userId, label: name };
    for (const f of CARD_FIELDS) row[f] = p[f] ?? null;
    await admin.from("cards").insert(row);
  }

  // Mark migrated so this runs at most once per account.
  await admin
    .from("profiles")
    .update({ customization: { ...customization, _migrated: true } })
    .eq("id", userId);
}
