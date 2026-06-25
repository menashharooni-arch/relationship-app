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
 * in one place. It is purely additive — it never deletes profile data, and it runs
 * at most once per account (skips if a card with the same username already exists).
 */
export async function ensureUserCards(userId: string): Promise<void> {
  const admin = getAdminSupabase();

  const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).single();
  if (!profile) return;

  const p = profile as Record<string, unknown>;
  const username = (p.username as string) || "";
  const name = (p.name as string) || "";

  // Only legacy profiles that were actually set up as a card (have a username + name).
  if (!username || !name) return;

  const { data: existing } = await admin
    .from("cards")
    .select("id")
    .eq("user_id", userId)
    .eq("username", username)
    .maybeSingle();
  if (existing) return; // already migrated

  const row: Record<string, unknown> = { user_id: userId, label: name };
  for (const f of CARD_FIELDS) row[f] = p[f] ?? null;

  // Best-effort: a unique-username clash just means it's effectively already there.
  await admin.from("cards").insert(row);
}
