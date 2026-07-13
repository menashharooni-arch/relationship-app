import { getAdminSupabase } from "@/lib/supabase-admin";

// The email an account was CREATED with — the Supabase AUTH email — which is the
// account's true identity for every OWNER-directed message (billing, receipts,
// marketing, welcome, trial notices).
//
// Why this exists: `profiles.email` is NOT a reliable account address. The
// "primary card" is stored on the profile row, so its public contact-email field
// writes straight into `profiles.email` (see /api/profile). The moment an owner
// sets a card contact email different from their login email, `profiles.email`
// drifts to the card's public address — and owner mail sent there lands at the
// wrong inbox. Always resolve the auth email for owner-directed mail.
export async function getAccountEmail(
  userId: string,
  fallback?: string | null,
): Promise<string | null> {
  try {
    const { data } = await getAdminSupabase().auth.admin.getUserById(userId);
    if (data?.user?.email) return data.user.email;
  } catch {
    /* fall through to the caller's fallback */
  }
  return fallback ?? null;
}

// Bulk variant for segment sends (marketing/promo): one page of auth users →
// a { userId: authEmail } map, so a blast doesn't do an admin lookup per row.
// Falls back to profiles.email per recipient at the call site for anyone not
// found on the fetched pages.
export async function getAccountEmailMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const admin = getAdminSupabase();
    // Page through all auth users (perPage max 1000). New product → a couple
    // pages at most; guard the loop so it always terminates.
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) if (u.email) map.set(u.id, u.email);
      if (data.users.length < 1000) break;
    }
  } catch {
    /* empty map → callers fall back to profiles.email */
  }
  return map;
}
