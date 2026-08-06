import { getAdminSupabase } from "@/lib/supabase-admin";

// ── Email preferences provisioning ───────────────────────────────────────────
//
// email_preferences holds the per-account unsubscribe_token. That token IS the
// unsubscribe mechanism: unsubUrl() returns undefined without one, the footer
// link degrades to a plain sentence, and the RFC 8058 List-Unsubscribe /
// List-Unsubscribe-Post header pair is omitted entirely — so a recipient has no
// one-click opt-out and /api/unsubscribe has no token to match them by.
//
// No account ever got a row. The only writer was POST /api/welcome, which
// nothing calls (the /welcome PAGE is unrelated), so every profile in the
// database had zero preferences rows — meaning every broadcast, promo blast and
// lifecycle email shipped with no working opt-out. That is CAN-SPAM §5(a)(3)
// and the Gmail/Yahoo bulk-sender rules, not a nicety.
//
// The row is deliberately minimal: marketing_emails and receipt_emails default
// to true in the schema, and unsubscribe_token defaults to a gen_random_uuid(),
// so inserting the user_id alone is enough to mint a usable token.

type Admin = ReturnType<typeof getAdminSupabase>;

/**
 * Make sure this user has an email_preferences row (and therefore an
 * unsubscribe token). Safe to call repeatedly and safe to call concurrently —
 * user_id is the primary key, so a race resolves to one row and the loser is
 * ignored rather than clobbering an existing opt-OUT back to opted-in.
 *
 * Best-effort by design: account provisioning must never fail because this
 * write did. A missing row degrades to "this user gets skipped by marketing
 * sends", which is the safe direction.
 */
export async function ensureEmailPreferences(userId: string, admin?: Admin): Promise<void> {
  if (!userId) return;
  const db = admin ?? getAdminSupabase();
  try {
    // ignoreDuplicates: an existing row must be left exactly as it is. A plain
    // upsert would reset marketing_emails to the column default and silently
    // re-subscribe someone who had opted out.
    await db.from("email_preferences").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  } catch (e) {
    console.error("[email-prefs] ensure failed:", e instanceof Error ? e.message : e);
  }
}
