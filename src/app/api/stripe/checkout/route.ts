import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";
import { PLAN_LIMITS } from "@/lib/plan";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

// The Stripe prices we actually sell. Anything else is rejected so a crafted
// request can't check out against an arbitrary/mispriced Price.
const PRO_PRICE_IDS = [
  process.env.STRIPE_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID,
].filter(Boolean) as string[];
const OFFICE_PRICE_IDS = [
  process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID,
].filter(Boolean) as string[];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, username, plan, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const priceId = body.priceId || process.env.STRIPE_PRICE_ID!;
    const couponId: string | undefined = typeof body.couponId === "string" ? body.couponId : undefined;

    // Only sell prices we actually offer.
    const isOffice = OFFICE_PRICE_IDS.includes(priceId);
    const isPro = PRO_PRICE_IDS.includes(priceId);
    if (!isOffice && !isPro) {
      return NextResponse.json({ error: "Unknown plan price." }, { status: 400 });
    }

    // Seats: Office is per-seat with a minimum; Pro is always a single seat.
    const requestedQty = typeof body.quantity === "number" ? Math.floor(body.quantity) : 1;
    let quantity = 1;
    if (isOffice) {
      if (requestedQty < PLAN_LIMITS.OFFICE_MIN_SEATS) {
        return NextResponse.json(
          { error: `The Office plan requires at least ${PLAN_LIMITS.OFFICE_MIN_SEATS} seats.` },
          { status: 400 }
        );
      }
      quantity = requestedQty;
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      client_reference_id: user.id,
      // Reuse the existing Stripe customer so re-subscribing doesn't create duplicates.
      ...(profile.stripe_customer_id
        ? { customer: profile.stripe_customer_id as string }
        : { customer_email: profile.email }),
      line_items: [{ price: priceId, quantity }],
      mode: "subscription",
      // Record the seat count so the webhook provisions the office reliably.
      ...(isOffice ? { metadata: { seats: String(quantity) } } : {}),
      success_url: `${APP_URL}/dashboard?upgraded=true`,
      cancel_url: `${APP_URL}/pricing`,
      // Either a pre-applied coupon OR a promo-code box (Stripe forbids both):
      // with no coupon, customers can type admin-created promo codes at checkout.
      ...(couponId ? { discounts: [{ coupon: couponId }] } : { allow_promotion_codes: true }),
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
