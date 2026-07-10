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
  let subCleared = false;
  if (plan === "free" && prof?.stripe_subscription_id) {
    try {
      const { getStripe } = await import("@/lib/stripe");
      await getStripe().subscriptions.cancel(prof.stripe_subscription_id as string);
      subCleared = true;
    } catch (e) {
      console.error("[admin set-plan] Stripe cancel failed:", e instanceof Error ? e.message : e);
      return NextResponse.json(
        { error: "Couldn't cancel the user's Stripe subscription — plan NOT changed (they would keep being billed). Cancel it in Stripe first, then retry." },
        { status: 502 }
      );
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ plan, plan_expires_at: null, customization: cust, ...(subCleared ? { stripe_subscription_id: null } : {}) })
    .eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
