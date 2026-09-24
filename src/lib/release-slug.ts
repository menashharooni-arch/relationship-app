import type { getAdminSupabase } from "@/lib/supabase-admin";

type Admin = ReturnType<typeof getAdminSupabase>;

// ── Let go of a card address cleanly ─────────────────────────────────────────
//
// A slug is a PUBLIC key: stored card images live at card-shares/<slug>.png
// and card-signatures/<slug>.png, and a Wallet pass's serial IS the slug. None
// of those follow a card when its address changes or the card goes away, so
// whoever registered the freed address next inherited them — their link
// previews and email signature showed the previous owner's card (name, phone,
// headshot), and every phone holding the old pass was pushed the NEW owner's
// card (isolation audit 2026-09-24).
//
// Called with EVERY address a card is giving up: the old slug on a rename, and
// the current slug plus all its `_prevSlugs` aliases when a card or account is
// deleted. Best-effort by contract — cleanup must never fail the caller.
export async function releaseSlugArtifacts(admin: Admin, slugs: (string | null | undefined)[]): Promise<void> {
  const list = [...new Set(slugs.filter((s): s is string => typeof s === "string" && s.length > 0))];
  if (!list.length) return;
  const objects = list.map((s) => `${s}.png`);
  await Promise.all([
    admin.storage.from("card-shares").remove(objects).then(() => {}, () => {}),
    admin.storage.from("card-signatures").remove(objects).then(() => {}, () => {}),
    // The pass on those phones simply stops updating; it can never become
    // someone else's card.
    Promise.resolve(admin.from("wallet_registrations").delete().in("serial", list)).then(() => {}, () => {}),
    Promise.resolve(admin.from("wallet_passes").delete().in("serial", list)).then(() => {}, () => {}),
  ]);
}

/** A card's former addresses (customization._prevSlugs). */
export function prevSlugsOf(customization: unknown): string[] {
  const c = (customization ?? {}) as { _prevSlugs?: unknown };
  return Array.isArray(c._prevSlugs) ? c._prevSlugs.filter((s): s is string => typeof s === "string" && s.length > 0) : [];
}
