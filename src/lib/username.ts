import { getAdminSupabase } from "@/lib/supabase-admin";

// ── Public card slug (username) uniqueness ───────────────────────────────────
// A card's `username` is only the public URL slug (/card/<username>) — it is NOT
// the account's identity. Identity is the email / auth user; the account handle
// (profiles.username) is already email-derived and unique. So a slug collision
// (two people named "Aaron Lavi" at "Malve Capital", or the same person's second
// card) must NEVER block card creation — we just pick the next free variant.
//
// A slug is "taken" if any CARD uses it OR any account handle (profiles.username)
// uses it, since the public /card/<username> route resolves against both.

// Lock to the same charset the API enforces on insert ([a-z0-9-], ≤60).
export function normalizeSlug(raw: string): string {
  const s = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-") // spaces / punctuation → hyphen
    .replace(/-+/g, "-")          // collapse runs
    .replace(/^-+|-+$/g, "")      // trim hyphens
    .slice(0, 60)
    .replace(/-+$/g, "");         // no trailing hyphen after the slice
  return s;
}

type Admin = ReturnType<typeof getAdminSupabase>;

async function slugTaken(admin: Admin, slug: string): Promise<boolean> {
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
  if (!root) root = "card";

  // Leave headroom for the "-<n>" / "-<rand>" suffix within the 60-char cap.
  const MAX_ROOT = 52;
  if (root.length > MAX_ROOT) root = root.slice(0, MAX_ROOT).replace(/-+$/g, "") || "card";

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
