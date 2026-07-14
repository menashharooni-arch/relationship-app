import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { planFromPriceId } from "@/lib/subscription";
import { PLAN_LIMITS } from "@/lib/plan";
import type Stripe from "stripe";

// GET /api/stripe/subscription — the read model the billing UI renders from.
// Reads the profile, and (when there's a live Stripe subscription) the
// authoritative subscription object, so the UI always reflects the true state
// right after an action, not just the webhook-synced DB snapshot.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_customer_id, stripe_subscription_id, plan_expires_at, customization")
    .eq("id", user.id)
    .single();

  const cust = (profile?.customization as Record<string, unknown> | null) ?? {};
  const dbPlan = (profile?.plan as string) ?? "free";
  const uiPlan = dbPlan === "enterprise" ? "office" : dbPlan; // present Office by its product name

  const base = {
    plan: uiPlan as "free" | "pro" | "office",
    interval: null as "monthly" | "annual" | null,
    status: null as string | null,
    seats: null as number | null,
    activeMembers: null as number | null,
    pendingInvites: null as number | null,
    ownerSeats: 1,
    scheduledSeats: null as number | null,
    scheduledSeatsAt: null as string | null,
    minSeats: PLAN_LIMITS.OFFICE_MIN_SEATS,
    currentPeriodEnd: null as string | null,
    cancelAtPeriodEnd: false,
    renewalCents: null as number | null,
    retentionUsed: cust._retentionUsed === true,
    paymentFailed: typeof cust._paymentFailedAt === "string",
    hasStripeSubscription: !!profile?.stripe_subscription_id,
    hasCustomer: !!profile?.stripe_customer_id,
  };

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json(base);
  }

  // Pull the live subscription so period-end / cancel-scheduled / seats are exact.
  try {
    const sub = (await getStripe().subscriptions.retrieve(profile.stripe_subscription_id)) as Stripe.Subscription;
    const item = sub.items.data[0];
    const priceId = item?.price?.id;
    const mapped = planFromPriceId(priceId);
    const periodEndUnix = (sub as unknown as { current_period_end?: number }).current_period_end;

    if (mapped) { base.plan = mapped.plan; base.interval = mapped.interval; }
    base.status = sub.status;
    base.cancelAtPeriodEnd = sub.cancel_at_period_end === true;
    base.currentPeriodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
    base.seats = mapped?.plan === "office" ? (item?.quantity ?? null) : null;
    const unit = item?.price?.unit_amount ?? null;
    base.renewalCents = unit != null ? unit * (item?.quantity ?? 1) : null;

    if (mapped?.plan === "office") {
      const { data: office } = await admin
        .from("offices")
        .select("id, scheduled_seats, scheduled_seats_at")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (office) {
        const [{ count: active }, { count: pending }] = await Promise.all([
          admin.from("office_members").select("*", { count: "exact", head: true }).eq("office_id", office.id).eq("status", "active"),
          admin.from("office_members").select("*", { count: "exact", head: true }).eq("office_id", office.id).eq("status", "pending"),
        ]);
        base.activeMembers = active ?? 0;
        base.pendingInvites = pending ?? 0;
        base.scheduledSeats = (office as { scheduled_seats?: number | null }).scheduled_seats ?? null;
        base.scheduledSeatsAt = (office as { scheduled_seats_at?: string | null }).scheduled_seats_at ?? null;
      }
    }
  } catch {
    // Stripe unreachable / sub deleted — fall back to the DB snapshot so the UI
    // still renders something coherent.
    base.cancelAtPeriodEnd = cust._cancelAtPeriodEnd === true;
    base.currentPeriodEnd = typeof cust._cancelAt === "string" ? (cust._cancelAt as string) : null;
  }

  return NextResponse.json(base);
}
