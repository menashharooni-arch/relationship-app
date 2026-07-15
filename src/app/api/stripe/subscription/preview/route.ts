import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { PLAN_LIMITS } from "@/lib/plan";
import { priceIdForPlan, planFromPriceId, isUpgrade, type BillingPlan, type BillingInterval } from "@/lib/subscription";
import type Stripe from "stripe";
import { officeSubUserBlockMessage } from "@/lib/office-roles";

// POST /api/stripe/subscription/preview { plan, interval, seats? }
//
// What will this plan change actually cost, right now? Stripe computes the
// proration (credit for the unused part of the current plan, charge for the new
// one); we just show it. Nothing is charged here — this is a dry run, so the
// customer sees the real number BEFORE they agree to it rather than finding out
// on their statement.
//
// The returned prorationDate MUST be passed back to change-plan: Stripe prorates
// by the second, so without pinning the same timestamp the amount we quoted and
// the amount we charge would drift apart between the two calls.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Office sub-users have no personal subscription to manage — billing is
  // the organization's. A delegated billing_admin passes through.
  const subBlocked = await officeSubUserBlockMessage(user.id, {
    unless: "manage_billing",
    message: "Billing for your account is managed by your organization.",
  });
  if (subBlocked) return NextResponse.json({ error: subBlocked }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const targetPlan = body.plan as BillingPlan;
  const interval = (body.interval === "annual" ? "annual" : "monthly") as BillingInterval;
  if (targetPlan !== "pro" && targetPlan !== "office") {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_customer_id, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  // No existing subscription → there's nothing to prorate; this is a first-time
  // purchase and belongs in checkout (which captures a card).
  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: "needs_checkout", needsCheckout: true }, { status: 409 });
  }

  const targetPriceId = priceIdForPlan(targetPlan, interval);
  if (!targetPriceId) return NextResponse.json({ error: "That plan isn't available right now." }, { status: 400 });

  const seats = targetPlan === "office"
    ? Math.max(PLAN_LIMITS.OFFICE_MIN_SEATS, Math.floor(Number(body.seats) || PLAN_LIMITS.OFFICE_MIN_SEATS))
    : 1;

  try {
    const stripe = getStripe();
    const sub = (await stripe.subscriptions.retrieve(profile.stripe_subscription_id)) as Stripe.Subscription;
    const item = sub.items.data[0];
    if (!item) return NextResponse.json({ error: "Subscription has no billable item." }, { status: 400 });

    const current = planFromPriceId(item.price?.id);
    const upgrading = isUpgrade(current, { plan: targetPlan, interval });

    // Pin the instant we prorate from, and quote from exactly that instant.
    const prorationDate = Math.floor(Date.now() / 1000);

    const preview = await stripe.invoices.createPreview({
      customer: (profile.stripe_customer_id as string) ?? (sub.customer as string),
      subscription: profile.stripe_subscription_id,
      subscription_details: {
        items: [{ id: item.id, price: targetPriceId, quantity: seats }],
        proration_behavior: "create_prorations",
        proration_date: prorationDate,
      },
    });

    // Only the proration lines belong in "what changes today" — the rest of the
    // upcoming invoice is the next cycle's normal charge, which this change
    // doesn't create.
    const prorationCents = (preview.lines?.data ?? [])
      .filter((l) => l.parent?.subscription_item_details?.proration)
      .reduce((sum, l) => sum + (l.amount ?? 0), 0);

    return NextResponse.json({
      ok: true,
      upgrading,
      currentPlan: current?.plan ?? null,
      currentInterval: current?.interval ?? null,
      targetPlan,
      targetInterval: interval,
      seats,
      prorationDate,
      // Net of the credit for unused time on the old plan. Can be negative on a
      // downgrade — that's a credit, not a refund.
      prorationCents,
      // What Stripe would actually collect if we invoice now (never below zero).
      dueTodayCents: Math.max(0, prorationCents),
      currency: preview.currency ?? "usd",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe proration preview error:", message);
    return NextResponse.json({ error: "Couldn't work out the price change. Please try again." }, { status: 502 });
  }
}
