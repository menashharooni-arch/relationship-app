import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { subscriptionPeriodEndIso } from "@/lib/stripe";
import { markProEnded } from "@/lib/pro-ended";

// User-initiated downgrade from Pro to Free — offered as an alternative to
// deleting the account ("Cancel Pro, keep my account").
//
// With a Stripe subscription it SCHEDULES the cancellation for the end of the
// period already paid for — exactly what Settings → Plan and billing → Cancel
// does. It used to cancel on the spot (subscriptions.cancel: no proration, no
// refund), so an annual subscriber lost the rest of the year they had paid
// for, and because it also cleared stripe_subscription_id before Stripe's
// deletion webhook arrived, that webhook could no longer find the account:
// no "choose which card stays live" step, no "Pro has ended" notice, and the
// extra cards stayed served from cache. Now the webhook does all of that at
// period end, the same way it does for every other cancellation, and "Keep
// subscription" in Billing can still undo it until then.
//
// If the Stripe call fails nothing changes, so an account can never read as
// cancelled while it is still being charged.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id, customization")
    .eq("id", user.id)
    .single();

  // Only an individual Pro account can self-downgrade here. Office/enterprise
  // (teams with seats) must be managed from the office settings.
  if (profile?.plan !== "pro") {
    return NextResponse.json({ error: "Only Pro accounts can downgrade here." }, { status: 400 });
  }

  const cust = { ...((profile.customization as Record<string, unknown>) ?? {}) };

  if (profile.stripe_subscription_id) {
    let cancelAt: string | null = null;
    try {
      const { getStripe } = await import("@/lib/stripe");
      const sub = (await getStripe().subscriptions.update(profile.stripe_subscription_id as string, {
        cancel_at_period_end: true,
        cancellation_details: { comment: "Chose Free instead of deleting the account" },
      })) as Stripe.Subscription;
      cancelAt = subscriptionPeriodEndIso(sub);
    } catch (e) {
      console.error("[account downgrade] Stripe cancel failed:", e instanceof Error ? e.message : e);
      return NextResponse.json(
        { error: "Couldn't cancel your subscription right now. Please try again in a moment." },
        { status: 502 },
      );
    }
    // The same mirror Billing's cancel writes, so Settings shows "cancels on
    // <date>" with Keep Subscription, and the trial notice / banner stand down.
    const { error } = await admin
      .from("profiles")
      .update({ customization: { ...cust, _cancelAtPeriodEnd: true, _cancelAt: cancelAt, _cancelReason: "downgrade_instead_of_delete" } })
      .eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, cancelAt });
  }

  // No subscription behind the plan (a free-Pro grant): nothing is being paid
  // for, so it ends now — through the same "Pro ended" step every other ending
  // uses, so they still choose which card stays live.
  delete cust._paymentFailedAt;
  const { error } = await admin
    .from("profiles")
    .update({ plan: "free", plan_expires_at: null, customization: cust })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await markProEnded(user.id, { wasTrial: false });

  return NextResponse.json({ ok: true, cancelAt: null });
}
