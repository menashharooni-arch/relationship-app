import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { reportError } from "@/lib/report-error";

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
    // analytics_events is keyed by USERNAME, not user_id. The delete further
    // down used .eq("user_id", …) against a column that doesn't exist, so
    // safeDelete swallowed the error and nothing was ever removed — the rows
    // outlived the account (a deletion-promise gap) and would be inherited by
    // whoever registered the slug next.
    await safeDelete(() => admin.from("analytics_events").delete().in("username", usernames));
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
  // (analytics_events is slug-keyed and handled above — it has no user_id column.)
  await safeDelete(() => admin.from("promo_code_redemptions").delete().eq("user_id", userId));
  await safeDelete(() => admin.from("referrals").delete().eq("referrer_id", userId));

  // Stored card IMAGES live in PUBLIC storage buckets keyed by card slug, so
  // deleting the rows above does not remove them: without this, a purged
  // account's full card image (name, phone, email, headshot) stays downloadable
  // at its public URL forever — contradicting the deletion promise — and any
  // freed slug re-registered later would serve this account's image on the new
  // owner's link previews and email signature.
  if (usernames.length) {
    const objects = usernames.map((u) => `${u}.png`);
    await safeDelete(() => admin.storage.from("card-shares").remove(objects));
    await safeDelete(() => admin.storage.from("card-signatures").remove(objects));
  }

  // card-uploads is the third public bucket and it was never cleaned. It holds
  // the ORIGINALS — every headshot and company logo the user ever uploaded,
  // plus the LinkedIn and photo-suggest imports — each written to
  // `<user-id>/<field>-<timestamp>.<ext>` by /api/upload, /api/drafts/claim,
  // /api/photo-suggest and /api/integrations/linkedin.
  //
  // Deleting the auth user does not touch storage, so without this the person's
  // FACE stayed downloadable at a public URL forever, after we told them their
  // data was "gone for good". That is the deletion promise in the Privacy
  // Policy and the delete dialog, and Apple §5.1.1(v) besides.
  //
  // Every writer uses upsert with a timestamped filename, so a long-lived
  // account accumulates far more than one object per field — well past the 100
  // that a single list() returns. Drain instead of paging: each pass removes
  // what it just listed, so the next list from the top returns the next batch.
  // The pass cap is a safety stop, not the expected exit — if a remove ever
  // fails silently, this ends rather than spinning forever.
  await safeDelete(async () => {
    for (let pass = 0; pass < 100; pass++) {
      const { data: files } = await admin.storage.from("card-uploads").list(userId, { limit: 100 });
      if (!files?.length) return;
      const { error } = await admin.storage
        .from("card-uploads")
        .remove(files.map((f) => `${userId}/${f.name}`));
      if (error) return;
    }
  });

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


// ── Billing must not outlive the account ────────────────────────────────────
//
// Deleting an account cancels its Stripe subscription (api/account/delete). If
// that call fails — an expired key, a Stripe incident, a rate limit — the
// account still has to be deleted: blocking deletion on a third party is both
// hostile and a violation of Apple's §5.1.1(v) account-deletion requirement.
//
// But the old code swallowed the failure with a bare `catch { /* ignore */ }`
// and carried on, which left a real card being charged for a product whose
// owner can no longer log in, cancel, or even see that it is happening. Nothing
// logged it, so nobody would ever find out.
//
// The rule now: deletion always proceeds, the failure is always reported, and
// the daily cron keeps retrying until the billing is actually stopped.

/**
 * Stop billing one subscription, tolerating the states where there is nothing
 * left to stop.
 *
 * "already" covers both a subscription Stripe has already cancelled and one it
 * no longer has at all — in each case the money has stopped, which is the only
 * thing this function is responsible for.
 */
export async function stopSubscription(subscriptionId: string): Promise<"canceled" | "already" | "failed"> {
  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    if (sub.status === "canceled" || sub.status === "incomplete_expired") return "already";
    await stripe.subscriptions.cancel(subscriptionId);
    return "canceled";
  } catch (e) {
    // The subscription is not in Stripe at all — nothing can bill.
    if ((e as { code?: string } | null)?.code === "resource_missing") return "already";
    return "failed";
  }
}

/**
 * Daily sweep: any account that is soft-deleted but still carries a
 * subscription id gets another cancellation attempt.
 *
 * This is what turns a transient Stripe failure during deletion into at most
 * 24 hours of wrong billing instead of an indefinite charge nobody is watching.
 * The id is cleared once the money has genuinely stopped, so a healthy account
 * is never retried and the sweep converges to zero work.
 */
export async function reconcileDeletedSubscriptions(): Promise<number> {
  const admin = getAdminSupabase();
  const { data: rows } = await admin
    .from("profiles")
    .select("id, stripe_subscription_id")
    .eq("customization->>_deleted", "true")
    .not("stripe_subscription_id", "is", null);

  let stopped = 0;
  for (const row of rows ?? []) {
    const subId = row.stripe_subscription_id as string;
    const result = await stopSubscription(subId);
    if (result === "failed") {
      await reportError("billing.deleted-account-still-billing", new Error(
        `Subscription ${subId} for deleted account ${row.id} could not be cancelled — the customer may still be charged.`,
      ));
      continue;
    }
    // Only cleared once the money has actually stopped, so a failure above
    // leaves the row for tomorrow's run rather than losing the record.
    await admin.from("profiles").update({ stripe_subscription_id: null }).eq("id", row.id as string);
    if (result === "canceled") stopped++;
  }
  return stopped;
}
