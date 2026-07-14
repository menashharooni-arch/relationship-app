import { getAdminSupabase } from "@/lib/supabase-admin";

// ── Hard-delete of soft-deleted accounts past the reopen window ───────────────
//
// Deleting an account (api/account/delete) SOFT-deletes: it stamps
// customization._deleted + _deletion.at and hides everything, kept for a 30-day
// reopen window (api/account/reopen). This module does the PERMANENT deletion
// once that window has passed, so the promise made in the Privacy Policy / Terms
// / delete dialog ("after that it's gone for good … removed from our production
// systems") is actually true — and so Apple's §5.1.1(v) requirement (account
// deletion must delete the account + associated data, not just deactivate) is
// met. Called by the daily cron (api/reminders).

export const PURGE_GRACE_DAYS = 30; // must match GRACE_DAYS in api/account/reopen

// Pure predicate: is a soft-deleted account past its reopen window and due for
// permanent deletion? A missing/blank timestamp (legacy soft-delete) counts as
// due so nothing can linger un-purged forever. Extracted for unit testing.
export function isPurgeDue(deletionAtIso: string | null | undefined, nowMs: number): boolean {
  const at = deletionAtIso ? new Date(deletionAtIso).getTime() : 0;
  if (!at || Number.isNaN(at)) return true;
  return nowMs - at >= PURGE_GRACE_DAYS * 24 * 60 * 60 * 1000;
}

// Each table delete is best-effort: a missing table/column in some environment
// must never block the core deletion (cards → profile → auth user). We log and
// continue rather than throw.
async function safeDelete(fn: () => PromiseLike<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    /* table/column may not exist in this schema — keep purging */
  }
}

type Admin = ReturnType<typeof getAdminSupabase>;

// Purge one user's data across every table, then the profile row and the auth
// user. Ordered children-first so nothing is orphaned. Idempotent — re-running
// on an already-mostly-purged user is harmless.
export async function purgeUserData(admin: Admin, userId: string): Promise<void> {
  // Card usernames own the lead/view/event data (keyed by slug, not user_id).
  const { data: cards } = await admin.from("cards").select("username").eq("user_id", userId);
  const usernames = (cards ?? []).map((c) => c.username as string).filter(Boolean);
  const viewKeys = usernames.flatMap((u) => [u, `${u}__links`]);

  // Lead-child rows are keyed by lead_id → resolve this user's lead ids first.
  let leadIds: string[] = [];
  if (usernames.length) {
    const { data: leads } = await admin.from("leads").select("id").in("card_owner", usernames);
    leadIds = (leads ?? []).map((l) => l.id as string).filter(Boolean);
  }
  if (leadIds.length) {
    await safeDelete(() => admin.from("lead_messages").delete().in("lead_id", leadIds));
    await safeDelete(() => admin.from("lead_reminders").delete().in("lead_id", leadIds));
    await safeDelete(() => admin.from("message_opt_outs").delete().in("lead_id", leadIds));
  }

  // Slug-scoped analytics + the leads themselves.
  if (usernames.length) {
    await safeDelete(() => admin.from("leads").delete().in("card_owner", usernames));
    await safeDelete(() => admin.from("card_events").delete().in("card_owner_username", usernames));
  }
  if (viewKeys.length) {
    await safeDelete(() => admin.from("card_views").delete().in("username", viewKeys));
  }

  // If this user OWNS an office, release its members (back to free, unbranded)
  // and delete the office + membership rows before removing the owner.
  const { data: ownedOffices } = await admin.from("offices").select("id").eq("owner_id", userId);
  for (const office of ownedOffices ?? []) {
    const officeId = office.id as string;
    const { data: members } = await admin
      .from("office_members")
      .select("user_id")
      .eq("office_id", officeId)
      .not("user_id", "is", null);
    for (const m of members ?? []) {
      if (m.user_id) {
        await safeDelete(() => admin.from("profiles").update({ plan: "free", office_id: null }).eq("id", m.user_id as string));
      }
    }
    await safeDelete(() => admin.from("office_members").delete().eq("office_id", officeId));
    await safeDelete(() => admin.from("offices").delete().eq("id", officeId));
  }

  // Everything keyed directly to this user_id.
  await safeDelete(() => admin.from("office_members").delete().eq("user_id", userId)); // memberships they hold
  await safeDelete(() => admin.from("notifications").delete().eq("user_id", userId));
  await safeDelete(() => admin.from("integrations").delete().eq("user_id", userId));
  await safeDelete(() => admin.from("push_subscriptions").delete().eq("user_id", userId));
  await safeDelete(() => admin.from("email_preferences").delete().eq("user_id", userId));
  await safeDelete(() => admin.from("email_logs").delete().eq("user_id", userId));
  await safeDelete(() => admin.from("analytics_events").delete().eq("user_id", userId));
  await safeDelete(() => admin.from("promo_code_redemptions").delete().eq("user_id", userId));
  await safeDelete(() => admin.from("referrals").delete().eq("referrer_id", userId));

  // Cards, then the profile row, then the auth identity.
  await safeDelete(() => admin.from("cards").delete().eq("user_id", userId));
  await safeDelete(() => admin.from("profiles").delete().eq("id", userId));
  await safeDelete(() => admin.auth.admin.deleteUser(userId));
}

// Find every account whose soft-delete grace window has elapsed and purge it.
// Returns the count purged (for the cron's response/logging).
export async function purgeExpiredDeletedAccounts(): Promise<number> {
  const admin = getAdminSupabase();

  // Only rows actually flagged deleted — the JSON filter keeps this well under
  // the PostgREST page cap regardless of total user count.
  const { data: candidates } = await admin
    .from("profiles")
    .select("id, customization")
    .eq("customization->>_deleted", "true");

  const nowMs = Date.now();
  let purged = 0;
  for (const row of candidates ?? []) {
    const cust = (row.customization ?? {}) as { _deletion?: { at?: string } };
    if (!isPurgeDue(cust._deletion?.at, nowMs)) continue;
    await purgeUserData(admin, row.id as string);
    purged++;
  }
  return purged;
}
