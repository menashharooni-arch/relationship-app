import { getAdminSupabase } from "@/lib/supabase-admin";
import { sendWelcomeWhenCardLive } from "@/lib/welcome-email";

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
    const { error: insertErr } = await admin.from("cards").insert(row);
    if (insertErr) {
      // Do NOT stamp _migrated. The insert result was previously ignored, so a
      // failure here (most plausibly a unique-violation on username, since card
      // slugs and profile handles share one namespace) left the account with no
      // card AND marked as migrated — meaning this function would never try
      // again. Leaving the flag unset makes the next call retry.
      console.error("[ensure-cards] card insert failed, not marking migrated:", insertErr.message);
      return;
    }
  }

  // The card this account never had now exists, so the welcome email it never
  // got can go — same trigger as every other creation path, and idempotent per
  // account (lib/welcome-email.ts). Awaited rather than after(): this runs
  // inside a server component render, which has no after() budget of its own,
  // and the send is best-effort and non-throwing either way.
  await sendWelcomeWhenCardLive(userId);

  // Mark migrated so this runs at most once per account.
  //
  // Re-read first. `customization` came from whatever rendered the page, and
  // between that render and this line the browser may have written to the same
  // shared JSONB column — the push switches and quiet-hours timezone live in
  // it, and this runs on exactly the first dashboard load where the timezone is
  // first reported. Writing the stale snapshot back deleted it. Merging a fresh
  // read leaves a window of microseconds instead of seconds, and lib/push-prefs
  // verifies its own writes to cover what is left.
  const { data: fresh } = await admin
    .from("profiles").select("customization").eq("id", userId).maybeSingle();
  const current = (fresh?.customization ?? customization ?? {}) as Record<string, unknown>;
  await admin
    .from("profiles")
    .update({ customization: { ...current, _migrated: true } })
    .eq("id", userId);
}
