import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { PLAN_LIMITS } from "@/lib/plan";
import { planFromPriceId } from "@/lib/subscription";
import { getOfficeSeatUsage, computeSeatUsage } from "@/lib/office-seats";
import { writeAudit } from "@/lib/audit";
import { requireOfficeCapability } from "@/lib/office-roles";
import type Stripe from "stripe";

// GET /api/stripe/subscription/seats — what the seat UI needs to offer "add a
// seat" and state the price before charging: current quantity, billing interval,
// the real per-seat unit_amount from Stripe, and live usage.
//
// Scoped by the SAME capability check as the POST (owner or billing_admin) and
// resolved through the office, not the caller's own profile — a billing_admin
// has no subscription of their own, so reading the caller's profile (as
// GET /api/stripe/subscription does) would report them as Free and hide the UI
// from someone the POST would happily authorize.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOfficeCapability(user.id, "manage_seats");
  if (!ctx) return NextResponse.json({ error: "You don't have permission to change seats." }, { status: 403 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id")
    .eq("id", ctx.ownerId)
    .single();

  const { data: office } = await admin.from("offices").select("seats").eq("id", ctx.officeId).maybeSingle();
  const purchased = (office?.seats as number | null) ?? PLAN_LIMITS.OFFICE_MIN_SEATS;
  const usage = await getOfficeSeatUsage(ctx.officeId, purchased);

  const base = {
    seats: usage.purchased,
    usage,
    interval: null as "monthly" | "annual" | null,
    perSeatCents: null as number | null,
    minSeats: PLAN_LIMITS.OFFICE_MIN_SEATS,
    // What one more seat actually costs TODAY (Stripe's own prorated figure for
    // the remainder of this billing period) and what the recurring total becomes.
    // Both null when Stripe can't quote — the UI then just omits the line rather
    // than guessing an amount someone is about to be charged.
    nextSeatProrationCents: null as number | null,
    nextSeatTotalCents: null as number | null,
    // False when the office has no Stripe subscription behind it (e.g. a plan
    // granted by hand) — there's nothing to bill, so the UI must not offer to.
    billable: profile?.plan === "enterprise" && !!profile.stripe_subscription_id,
  };
  if (!base.billable) return NextResponse.json(base);

  try {
    const stripe = getStripe();
    const sub = (await stripe.subscriptions.retrieve(profile!.stripe_subscription_id!)) as Stripe.Subscription;
    const item = sub.items.data[0];
    const mapped = planFromPriceId(item?.price?.id);
    if (!item || mapped?.plan !== "office") return NextResponse.json({ ...base, billable: false });
    // Stripe is authoritative for what they're actually paying for.
    base.seats = item.quantity ?? base.seats;
    base.usage = { ...usage, ...computeSeatUsage(base.seats, usage.active, usage.pending) };
    base.interval = mapped.interval;
    base.perSeatCents = item.price?.unit_amount ?? null;
    if (base.perSeatCents != null) base.nextSeatTotalCents = base.perSeatCents * (base.seats + 1);

    // Quote one more seat. Best-effort: an extra API call that must never stop
    // the seat UI from rendering.
    try {
      const preview = await stripe.invoices.createPreview({
        customer: sub.customer as string,
        subscription: profile!.stripe_subscription_id!,
        subscription_details: {
          items: [{ id: item.id, quantity: base.seats + 1 }],
          proration_behavior: "create_prorations",
          proration_date: Math.floor(Date.now() / 1000),
        },
      });
      // Only the proration lines — the preview also contains the next renewal.
      const prorated = (preview.lines?.data ?? [])
        .filter((l) => (l as unknown as { proration?: boolean }).proration === true)
        .reduce((s, l) => s + (l.amount ?? 0), 0);
      base.nextSeatProrationCents = Math.max(0, prorated);
    } catch {
      // Leave null → the modal drops the "charged today" line.
    }
  } catch {
    return NextResponse.json({ ...base, billable: false });
  }
  return NextResponse.json(base);
}

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
      //
      // always_invoice, NOT create_prorations: Stripe does not bill a positive
      // proration on its own — create_prorations only parks the line item on the
      // next renewal invoice, so an extra seat bought today would be used free
      // until the cycle rolled over. always_invoice finalizes an invoice for the
      // prorated remainder now and charges the card on file.
      //
      // Idempotency: this endpoint charges money, and the obvious failure is a
      // double-click (or a retry after a timeout) buying two seats. The key is
      // the TRANSITION, not the request — two clicks both read current=3 and ask
      // for 4, produce the same key, and Stripe collapses them into one charge.
      // A later, genuinely different change (4→5) keys differently and goes
      // through. Deriving it server-side from Stripe's own quantity means a
      // client can't defeat it by varying its payload.
      const idempotencyKey = `office-seats:${profile.stripe_subscription_id}:${current}->${requested}`;
      const updated = await getStripe().subscriptions.update(
        profile.stripe_subscription_id,
        { items: [{ id: item.id, quantity: requested }], proration_behavior: "always_invoice" },
        { idempotencyKey },
      );
      // DB only after Stripe confirms — if the charge failed, the office must not
      // believe it owns a seat it never bought.
      await admin.from("offices").update({ seats: requested, scheduled_seats: null, scheduled_seats_at: null }).eq("id", office.id);
      await writeAudit({ action: "seat.changed", actorId: user.id, orgId: office.id as string, metadata: { seats: requested, mode: "increase" } });
      const unit = updated.items.data[0]?.price?.unit_amount ?? item.price?.unit_amount ?? null;
      return NextResponse.json({
        ok: true,
        mode: "increased",
        seats: requested,
        perSeatCents: unit,
        totalCents: unit != null ? unit * requested : null,
        interval: mapped.interval,
      });
    }

    if (requested === current) {
      // No change — treat as "cancel any scheduled reduction".
      await admin.from("offices").update({ scheduled_seats: null, scheduled_seats_at: null }).eq("id", office.id);
      await writeAudit({ action: "seat.reduction_canceled", actorId: user.id, orgId: office.id as string });
      return NextResponse.json({ ok: true, mode: "unchanged", seats: current });
    }

    // REDUCTION → schedule for the END of the current billing period (spec §5).
    // Current seats stay billable + available until then; a daily job applies it.
    //
    // Guard: if Stripe didn't return a period end, storing scheduled_seats_at as
    // null would make the reduction NEVER apply (the cron filters
    // `.lte("scheduled_seats_at", now)`, which never matches null) — the banner
    // would show forever and the customer keep paying the higher quantity. Fail
    // loudly instead. (billing audit #11)
    if (!periodEnd) {
      return NextResponse.json(
        { error: "no_period_end", message: "We couldn't schedule the seat reduction right now. Please try again in a moment." },
        { status: 503 }
      );
    }
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
