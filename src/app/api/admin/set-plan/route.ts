import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin";

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, plan } = await req.json();
  if (!userId || !["free", "pro", "enterprise"].includes(plan)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const admin = getAdminSupabase();

  // A directly-set plan is a REAL plan, not a temporary grant. Clear any
  // free-month/trial expiry and the trial bookkeeping flags — otherwise:
  //   • the dashboard shows a bogus "free Pro trial ending" banner, and
  //   • the daily cron downgrades this account back to Free when that stale
  //     plan_expires_at passes, silently undoing the sandbox setting.
  const { data: prof } = await admin.from("profiles").select("customization, stripe_subscription_id").eq("id", userId).maybeSingle();
  const cust = { ...((prof?.customization as Record<string, unknown>) ?? {}) };
  delete cust._trial;
  delete cust._trialStarted;
  delete cust._trialEnded;
  delete cust._proWarnedFor;
  delete cust._seqPaused;
  // A stale grace-period clock must not survive an admin-set plan change —
  // otherwise the reminders cron can auto-cancel a subscription an admin just
  // manually restored (e.g. as a support courtesy), undoing the fix.
  delete cust._paymentFailedAt;

  // Downgrading to free must ALSO stop the billing — otherwise the user shows
  // as free in the app while Stripe keeps charging them every month.
  if (plan === "free" && prof?.stripe_subscription_id) {
    try {
      const { getStripe } = await import("@/lib/stripe");
      await getStripe().subscriptions.cancel(prof.stripe_subscription_id as string);
    } catch (e) {
      console.error("[admin set-plan] Stripe cancel failed:", e instanceof Error ? e.message : e);
      return NextResponse.json(
        { error: "Couldn't cancel the user's Stripe subscription — plan NOT changed (they would keep being billed). Cancel it in Stripe first, then retry." },
        { status: 502 }
      );
    }
  }

  // stripe_subscription_id is deliberately LEFT SET after the cancel above.
  //
  // Cancelling fires customer.subscription.deleted, and that handler finds the
  // profile by `.eq("stripe_subscription_id", sub.id)` — it is the only handle
  // it has. This route used to null the column in this very statement, in the
  // same synchronous request, so the webhook arrived moments later and matched
  // nothing. Everything downstream of that lookup silently never ran: seat
  // holders kept plan='enterprise' with nobody paying, the offices row
  // survived, the brand stayed applied, and the ex-owner kept every office
  // capability.
  //
  // The webhook clears the column itself as the FINAL step of that cascade,
  // and its own comment explains why it waits — the same retry-idempotency
  // reasoning this route was quietly breaking from the outside.
  const { error } = await admin
    .from("profiles")
    .update({ plan, plan_expires_at: null, customization: cust })
    .eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
