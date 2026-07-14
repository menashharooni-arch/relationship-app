import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { PLAN_LIMITS } from "@/lib/plan";
import { planFromPriceId } from "@/lib/subscription";
import { getOfficeSeatUsage } from "@/lib/office-seats";
import { writeAudit } from "@/lib/audit";
import { requireOfficeCapability } from "@/lib/office-roles";
import type Stripe from "stripe";

// POST /api/stripe/subscription/seats { seats }
// Change the Office seat count. Allowed for the owner AND a billing_admin — a
// delegated billing admin acts on the OWNER's subscription. Enforces the 2-seat
// minimum and refuses to drop below seats in use (owner + active + pending).
// Stripe prorates the change (create_prorations).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const requested = Math.floor(Number(body.seats));
  if (!Number.isFinite(requested)) return NextResponse.json({ error: "Invalid seat count." }, { status: 400 });
  if (requested < PLAN_LIMITS.OFFICE_MIN_SEATS) {
    return NextResponse.json({ error: `Office requires at least ${PLAN_LIMITS.OFFICE_MIN_SEATS} seats.` }, { status: 400 });
  }

  // Server-side authorization: caller must have manage_seats (owner or billing_admin).
  const ctx = await requireOfficeCapability(user.id, "manage_seats");
  if (!ctx) return NextResponse.json({ error: "You don't have permission to change seats." }, { status: 403 });

  const admin = getAdminSupabase();
  // The subscription belongs to the office OWNER (a billing_admin acts on it).
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id")
    .eq("id", ctx.ownerId)
    .single();

  if (profile?.plan !== "enterprise" || !profile.stripe_subscription_id) {
    return NextResponse.json({ error: "Seats can only be changed on an active Office plan." }, { status: 400 });
  }

  const office = { id: ctx.officeId };

  // Never strand anyone: seats can't drop below what's in use — owner (seat 1)
  // + active members + pending invitations (which reserve a seat). Revoke
  // invites / remove members first to free the seats.
  const usage = await getOfficeSeatUsage(office.id as string, requested);
  const inUse = usage.ownerSeats + usage.active + usage.pending;
  if (requested < inUse) {
    return NextResponse.json(
      { error: `You're using ${inUse} of your seats (you + ${usage.active} active + ${usage.pending} pending). Remove members or revoke invitations before reducing to ${requested} seats.` },
      { status: 409 }
    );
  }

  try {
    const sub = (await getStripe().subscriptions.retrieve(profile.stripe_subscription_id)) as Stripe.Subscription;
    const item = sub.items.data[0];
    // Guard: only touch it if it really is an Office (per-seat) price.
    const mapped = planFromPriceId(item?.price?.id);
    if (!item || mapped?.plan !== "office") {
      return NextResponse.json({ error: "This subscription isn't an Office plan." }, { status: 400 });
    }
    const current = item.quantity ?? PLAN_LIMITS.OFFICE_MIN_SEATS;
    const periodEndUnix = (sub as unknown as { current_period_end?: number }).current_period_end;
    const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

    if (requested > current) {
      // INCREASE → effective immediately, prorated (spec §4/§6). Also cancels any
      // pending scheduled reduction (you're going up, not down).
      await getStripe().subscriptions.update(profile.stripe_subscription_id, {
        items: [{ id: item.id, quantity: requested }],
        proration_behavior: "create_prorations",
      });
      await admin.from("offices").update({ seats: requested, scheduled_seats: null, scheduled_seats_at: null }).eq("id", office.id);
      await writeAudit({ action: "seat.changed", actorId: user.id, orgId: office.id as string, metadata: { seats: requested, mode: "increase" } });
      return NextResponse.json({ ok: true, mode: "increased", seats: requested });
    }

    if (requested === current) {
      // No change — treat as "cancel any scheduled reduction".
      await admin.from("offices").update({ scheduled_seats: null, scheduled_seats_at: null }).eq("id", office.id);
      await writeAudit({ action: "seat.reduction_canceled", actorId: user.id, orgId: office.id as string });
      return NextResponse.json({ ok: true, mode: "unchanged", seats: current });
    }

    // REDUCTION → schedule for the END of the current billing period (spec §5).
    // Current seats stay billable + available until then; a daily job applies it.
    await admin
      .from("offices")
      .update({ scheduled_seats: requested, scheduled_seats_at: periodEnd })
      .eq("id", office.id);
    await writeAudit({ action: "seat.reduction_scheduled", actorId: user.id, orgId: office.id as string, metadata: { from: current, to: requested, effectiveAt: periodEnd } });
    return NextResponse.json({ ok: true, mode: "scheduled", seats: current, scheduledSeats: requested, effectiveAt: periodEnd });
  } catch {
    return NextResponse.json({ error: "Couldn't update seats. Please try again." }, { status: 502 });
  }
}
