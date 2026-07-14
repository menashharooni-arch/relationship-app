import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { PLAN_LIMITS } from "@/lib/plan";
import { planFromPriceId } from "@/lib/subscription";
import { getOfficeSeatUsage } from "@/lib/office-seats";
import type Stripe from "stripe";

// POST /api/stripe/subscription/seats { seats }
// Change the Office seat count. Enforces the 2-seat minimum and refuses to drop
// below the number of ACTIVE members (they'd lose access mid-cycle). Stripe
// prorates the change (create_prorations) so the customer is charged/credited
// the difference immediately. offices.seats is synced here and by the webhook.
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

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  if (profile?.plan !== "enterprise" || !profile.stripe_subscription_id) {
    return NextResponse.json({ error: "Seats can only be changed on an active Office plan." }, { status: 400 });
  }

  const { data: office } = await admin.from("offices").select("id").eq("owner_id", user.id).maybeSingle();
  if (!office) return NextResponse.json({ error: "No office found." }, { status: 404 });

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
    await getStripe().subscriptions.update(profile.stripe_subscription_id, {
      items: [{ id: item.id, quantity: requested }],
      proration_behavior: "create_prorations",
    });
  } catch {
    return NextResponse.json({ error: "Couldn't update seats. Please try again." }, { status: 502 });
  }

  await admin.from("offices").update({ seats: requested }).eq("id", office.id);
  return NextResponse.json({ ok: true, seats: requested });
}
