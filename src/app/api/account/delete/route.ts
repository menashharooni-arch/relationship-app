import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isRateLimited } from "@/lib/rate-limit";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { stopSubscription } from "@/lib/account-purge";
import { reportError } from "@/lib/report-error";
import { officeSubUserBlockMessage } from "@/lib/office-roles";
import { revokeAppleTokensOnDelete } from "@/lib/apple-revoke";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Per-user throttle: authenticated but previously uncapped (cost/abuse guard).
  if (await isRateLimited(`account-delete:${user.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests — please wait a moment and try again." }, { status: 429 });
  }


  // An office sub-user's account is company-managed: soft-deleting it would
  // orphan a paid seat and their branded card. They leave via the team admin
  // (Remove member), which cleanly unwinds the seat, plan, and branding.
  const blocked = await officeSubUserBlockMessage(user.id, {
    message: "Your account is part of your organization's team. Ask your Office admin to remove you from the team instead.",
  });
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : "";
  const comment = typeof body.comment === "string" ? body.comment.slice(0, 1000) : "";

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id, customization")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "No account" }, { status: 404 });

  // Cancel any active subscription so the user stops being billed.
  //
  // Deletion proceeds either way — blocking it on Stripe would be hostile and
  // would break Apple's §5.1.1(v) account-deletion requirement. But a failure
  // here means a real card is still being charged for an account that can no
  // longer log in to stop it, so it is REPORTED rather than swallowed, the id
  // is left on the row, and the daily cron retries until the money stops
  // (reconcileDeletedSubscriptions). The previous `catch { /* ignore */ }`
  // made that an invisible, indefinite charge.
  if (profile.stripe_subscription_id) {
    const result = await stopSubscription(profile.stripe_subscription_id);
    if (result === "failed") {
      await reportError("billing.cancel-on-delete-failed", new Error(
        `Could not cancel ${profile.stripe_subscription_id} while deleting ${user.id} — retrying daily.`,
      ));
    } else {
      // Money has stopped; nothing for the sweep to pick up.
      await admin.from("profiles").update({ stripe_subscription_id: null }).eq("id", user.id);
    }
  }

  // Soft-delete: the account and its cards/contacts are hidden immediately, but kept
  // for a 1-month reopen window. The auth user + profile row stay so the email can
  // never be reused. After the grace period it's permanently gone (reopen denied).
  const customization = (profile.customization as Record<string, unknown> | null) ?? {};
  await admin
    .from("profiles")
    .update({
      plan: "free",
      customization: {
        ...customization,
        _deleted: true,
        _deletion: { reason, comment, plan: profile.plan, at: new Date().toISOString() },
      },
    })
    .eq("id", user.id);

  // Tell the owner while the person is still reachable. Best-effort and never
  // awaited into the failure path: App Review 5.1.1(v) requires deletion to
  // complete, so a notification problem must not stand in its way.
  try {
    const { alertRetention } = await import("@/lib/retention-alert");
    await alertRetention({
      userId: user.id,
      email: user.email ?? null,
      plan: (profile.plan as string | null) ?? null,
      outcome: "deleted",
      reason,
      comment,
    });
  } catch {
    /* never block deletion */
  }

  // Sign in with Apple (requirement 6.2): if this account was created with an
  // Apple identity, revoke its Apple tokens. Best-effort and fully guarded — it
  // never blocks deletion, and it's a no-op for every current account (no user
  // has an Apple identity yet, and the Apple env vars aren't set).
  try {
    await revokeAppleTokensOnDelete(user);
  } catch {
    /* never block deletion */
  }

  // End the session.
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true });
}
