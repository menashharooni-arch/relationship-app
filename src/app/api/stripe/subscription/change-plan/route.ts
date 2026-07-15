import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { PLAN_LIMITS } from "@/lib/plan";
import { priceIdForPlan, planFromPriceId, isUpgrade, DB_PLAN, type BillingPlan, type BillingInterval } from "@/lib/subscription";
import { getOfficeBrand, stripBrandFromUserCards, memberFallbackPlan } from "@/lib/office-brand";
import type Stripe from "stripe";
import { officeSubUserBlockMessage } from "@/lib/office-roles";

// POST /api/stripe/subscription/change-plan { plan: "pro"|"office", interval, seats? }
// Switches an EXISTING paid subscription between Pro and Office (and between
// monthly/annual), prorated. Free→paid must go through checkout (card capture),
// and paid→Free is the Cancel flow — both are rejected here so each action stays
// separate and honest, exactly as required.
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
    return NextResponse.json({ error: "To move to Free, cancel your subscription instead." }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_subscription_id) {
    // No subscription to modify — this is a first-time purchase; the client
    // should send them through checkout (which captures a card).
    return NextResponse.json({ error: "needs_checkout", needsCheckout: true }, { status: 409 });
  }

  const targetPriceId = priceIdForPlan(targetPlan, interval);
  if (!targetPriceId) {
    return NextResponse.json({ error: "That plan isn't available right now." }, { status: 400 });
  }

  // Seats only matter for Office; clamp to the minimum.
  let seats = 1;
  if (targetPlan === "office") {
    seats = Math.max(PLAN_LIMITS.OFFICE_MIN_SEATS, Math.floor(Number(body.seats) || PLAN_LIMITS.OFFICE_MIN_SEATS));
  }

  const wasOffice = profile.plan === "enterprise";

  // Perform the swap on Stripe with proration.
  try {
    const sub = (await getStripe().subscriptions.retrieve(profile.stripe_subscription_id)) as Stripe.Subscription;
    const item = sub.items.data[0];
    if (!item) return NextResponse.json({ error: "Subscription has no billable item." }, { status: 400 });

    const current = planFromPriceId(item.price?.id);
    if (current && current.plan === targetPlan && current.interval === interval && targetPlan !== "office") {
      return NextResponse.json({ error: "You're already on that plan." }, { status: 400 });
    }

    // Upgrading = the customer gets a bigger plan the moment this returns, so
    // they're invoiced for it now (Stripe credits the unused part of the old
    // plan first). Without this the proration would sit on the NEXT invoice and
    // they'd have Office free until their billing date. Adding seats to an
    // existing Office plan counts as an upgrade for the same reason.
    // Downgrades/lateral moves keep create_prorations: the credit rides the next
    // invoice, so we never owe a cash refund.
    const addingSeats = targetPlan === "office" && seats > (item.quantity ?? 1);
    const upgrading = isUpgrade(current, { plan: targetPlan, interval }) || addingSeats;

    // Honour the timestamp the preview quoted from, so the amount we showed is
    // the amount we charge — Stripe prorates by the second, and re-deriving
    // "now" here would drift from the quote by however long the user took to
    // click. Ignore a stale/implausible value rather than trust the client.
    const clientDate = Math.floor(Number(body.prorationDate));
    const nowSec = Math.floor(Date.now() / 1000);
    const prorationDate =
      Number.isFinite(clientDate) && clientDate > nowSec - 15 * 60 && clientDate <= nowSec
        ? clientDate
        : undefined;

    await getStripe().subscriptions.update(profile.stripe_subscription_id, {
      items: [{ id: item.id, price: targetPriceId, quantity: seats }],
      proration_behavior: upgrading ? "always_invoice" : "create_prorations",
      ...(prorationDate ? { proration_date: prorationDate } : {}),
      cancel_at_period_end: false, // switching plans clears any pending cancel
    });
  } catch (err) {
    // A declined card on the immediate upgrade invoice must say so plainly —
    // "try again" would just fail the same way.
    const e = err as { code?: string; type?: string; message?: string };
    if (e?.type === "StripeCardError" || e?.code === "card_declined") {
      return NextResponse.json(
        { error: "Your card was declined, so the plan wasn't changed. Update your payment method and try again." },
        { status: 402 }
      );
    }
    console.error("Stripe change-plan error:", e?.message ?? err);
    return NextResponse.json({ error: "Couldn't change your plan. Please try again." }, { status: 502 });
  }

  // Reflect the new plan immediately (the webhook also reconciles this).
  const cust = await getPlanCleanCustomization(admin, user.id);
  await admin.from("profiles").update({ plan: DB_PLAN[targetPlan], customization: cust }).eq("id", user.id);

  if (targetPlan === "office") {
    // Provision (or update) the owner's office row.
    const { data: existing } = await admin.from("offices").select("id").eq("owner_id", user.id).maybeSingle();
    if (existing) {
      await admin.from("offices").update({ seats }).eq("id", existing.id);
    } else {
      const { data: prof } = await admin.from("profiles").select("name, company").eq("id", user.id).maybeSingle();
      const officeName = (prof?.company as string) || (prof?.name ? `${prof.name}'s Team` : "My Office");
      await admin.from("offices").insert({ owner_id: user.id, name: officeName, seats });
    }
  } else if (wasOffice) {
    // Leaving Office → tear the office down: release every active member back to
    // their own plan, strip the office brand from their cards, remove the office.
    const { data: office } = await admin.from("offices").select("id").eq("owner_id", user.id).maybeSingle();
    if (office) {
      const brand = await getOfficeBrand(office.id).catch(() => null);
      const { data: members } = await admin
        .from("office_members")
        .select("user_id")
        .eq("office_id", office.id)
        .not("user_id", "is", null);
      for (const m of members ?? []) {
        if (m.user_id) {
          const fallback = await memberFallbackPlan(m.user_id as string);
          await admin.from("profiles").update({ plan: fallback, office_id: null, plan_expires_at: null }).eq("id", m.user_id as string);
          await stripBrandFromUserCards(m.user_id as string, brand).catch(() => {});
        }
      }
      await admin.from("office_members").delete().eq("office_id", office.id);
      await admin.from("offices").delete().eq("id", office.id);
    }
  }

  return NextResponse.json({ ok: true, plan: targetPlan, interval, seats });
}

// Switching plans means the customer is staying — clear any pending-cancel mirror.
async function getPlanCleanCustomization(admin: ReturnType<typeof getAdminSupabase>, userId: string) {
  const { data } = await admin.from("profiles").select("customization").eq("id", userId).single();
  const cust = { ...((data?.customization as Record<string, unknown> | null) ?? {}) };
  delete cust._cancelAtPeriodEnd;
  delete cust._cancelAt;
  delete cust._cancelReason;
  return cust;
}
