import { getAdminSupabase } from "@/lib/supabase-admin";
import { normalizeSlug, isReservedSlug } from "@/lib/slug";

// ── Public card slug (username) uniqueness ───────────────────────────────────
// A card's `username` is only the public URL slug (/card/<username>) — it is NOT
// the account's identity. Identity is the email / auth user; the account handle
// (profiles.username) is already email-derived and unique. So a slug collision
// (two people named "Aaron Lavi" at "Malve Capital", or the same person's second
// card) must NEVER block card creation — we just pick the next free variant.
//
// A slug is "taken" if any CARD uses it OR any account handle (profiles.username)
// uses it, since the public /card/<username> route resolves against both.

// Re-exported from the pure @/lib/slug module (no server deps) so client code
// and this server module share ONE normalizer — the slug a user is shown while
// creating/editing a card is exactly what gets saved.
export { normalizeSlug };

type Admin = ReturnType<typeof getAdminSupabase>;

/**
 * Is this slug already in use by EITHER a card or a profile?
 *
 * Card slugs and profile handles share one public namespace (/card/<slug>
 * resolves against both), so checking only one table is not a check. Exported
 * because the admin create-card route was doing exactly that — see the comment
 * at its call site.
 */
export async function slugTaken(admin: Admin, slug: string): Promise<boolean> {
  // Card pages live at the ROOT since 2026-08-19, so an app route name is
  // permanently "taken" — a card at /pricing would be unreachable.
  if (isReservedSlug(slug)) return true;
  const [{ data: card }, { data: profile }] = await Promise.all([
    admin.from("cards").select("id").eq("username", slug).limit(1).maybeSingle(),
    admin.from("profiles").select("id").eq("username", slug).limit(1).maybeSingle(),
  ]);
  return !!card || !!profile;
}

// Return an available slug based on `base`, appending -2, -3, … then a short
// random suffix if we somehow exhaust the numbered range. Always returns a valid,
// non-empty, ≤60-char slug — never throws, so card creation can't be blocked.
export async function ensureUniqueUsername(base: string, admin: Admin = getAdminSupabase()): Promise<string> {
  let root = normalizeSlug(base);
  if (!root) root = "my-card"; // "card" itself is a reserved route since the root-URL move

  // Leave headroom for the "-<n>" / "-<rand>" suffix within the 60-char cap.
  const MAX_ROOT = 52;
  if (root.length > MAX_ROOT) root = root.slice(0, MAX_ROOT).replace(/-+$/g, "") || "my-card";

  if (!(await slugTaken(admin, root))) return root;

  for (let n = 2; n <= 60; n++) {
    const candidate = `${root}-${n}`;
    if (!(await slugTaken(admin, candidate))) return candidate;
  }

  // Extremely unlikely fall-through — a stable-ish random suffix. Retry a few
  // times in case of a collision; the caller's insert also catches a 23505 race.
  for (let i = 0; i < 5; i++) {
    const rand = Math.floor(Date.now() % 1_000_000).toString(36) + i;
    const candidate = `${root}-${rand}`.slice(0, 60);
    if (!(await slugTaken(admin, candidate))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`.slice(0, 60);
}
