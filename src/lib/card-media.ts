import type { SupabaseClient } from "@supabase/supabase-js";

// ── Per-card headshot resolution ─────────────────────────────────────────────
// The headshot used to live ONLY on the account (profiles.photo_url) and was
// shared across every card — so a new card with no headshot would show a
// headshot uploaded on a DIFFERENT card (cross-card bleed). Headshots are now
// per-card, stored on the card's own customization.photoUrl.
//
// Resolution rule (backward-compatible):
//   • If the card has set an explicit preference — the `photoUrl` KEY exists in
//     its customization (even if null) — use exactly that. A new card with no
//     headshot has photoUrl:null → shows NO headshot, never another card's.
//   • Legacy cards created before this change have no `photoUrl` key → fall back
//     to the account photo so existing users don't lose their picture.
export function cardHeadshot(
  cardCustomization: unknown,
  accountPhotoUrl: string | null | undefined,
): string | null {
  const c = (cardCustomization ?? {}) as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(c, "photoUrl")) {
    return (c.photoUrl as string | null) ?? null;
  }
  return accountPhotoUrl ?? null;
}

// One-time backfill so no card ever shows another card's headshot again. For
// each of the account's cards that has never set an explicit headshot: the
// OLDEST card inherits the shared account photo (its appearance doesn't change);
// every newer card is blanked (photoUrl:null) so a card that only ever showed
// the *shared* photo now shows nothing. Single-card accounts see no change; the
// only visible effect is that bled-in photos on secondary cards disappear.
// Idempotent — guarded by a `_photoMigrated` flag on the profile.
export async function backfillCardPhotos(
  admin: SupabaseClient,
  userId: string,
  profileCustomization: Record<string, unknown> | null | undefined,
  accountPhotoUrl: string | null | undefined,
): Promise<void> {
  const cust = (profileCustomization ?? {}) as Record<string, unknown>;
  if (cust._photoMigrated) return;
  try {
    const { data: cards } = await admin
      .from("cards")
      .select("id, customization")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    const list = cards ?? [];
    for (let i = 0; i < list.length; i++) {
      const cc = (list[i].customization ?? {}) as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(cc, "photoUrl")) continue; // already explicit
      const value = i === 0 ? (accountPhotoUrl ?? null) : null;
      await admin.from("cards").update({ customization: { ...cc, photoUrl: value } }).eq("id", list[i].id);
    }
    await admin.from("profiles").update({ customization: { ...cust, _photoMigrated: true } }).eq("id", userId);
  } catch { /* best-effort — worst case the render fallback still applies */ }
}
