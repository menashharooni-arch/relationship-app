import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { PLAN_LIMITS, PLAN_PRICES, TRIAL_DAYS } from "@/lib/plan";
import { isFreeDays } from "@/lib/promo";
import { priceIdForPlan, type BillingInterval } from "@/lib/subscription";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

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

// Expected unit_amount (cents) per configured price ID, so a Stripe Product
// mispriced in the dashboard (typo, forgot to update it, wrong catalog) can
// never silently charge someone something other than what /pricing showed them.
const EXPECTED_CENTS: Record<string, number> = {};
if (process.env.STRIPE_PRICE_ID) EXPECTED_CENTS[process.env.STRIPE_PRICE_ID] = PLAN_PRICES.PRO_MONTHLY_CENTS;
if (process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID) EXPECTED_CENTS[process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID] = PLAN_PRICES.PRO_MONTHLY_CENTS;
if (process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID) EXPECTED_CENTS[process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID] = PLAN_PRICES.PRO_ANNUAL_CENTS;
if (process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID) EXPECTED_CENTS[process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID] = PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS;
if (process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID) EXPECTED_CENTS[process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID] = PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, username, plan, stripe_customer_id, stripe_subscription_id")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

    // Duplicate-subscription guard: a paying customer must NOT start a second
    // checkout (that would create a duplicate subscription / double charge).
    // Send them to Billing to CHANGE their plan instead.
    if ((profile.plan === "pro" || profile.plan === "enterprise") && profile.stripe_subscription_id) {
      return NextResponse.json(
        { error: "already_subscribed", message: "You already have an active subscription. Change your plan in Settings → Billing.", redirect: "/settings/flows?billing=1" },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // ── Promo resolution (server-side, never the client's word) ───────────────
    // This used to read `couponId` straight out of the request body and hand it
    // to Stripe. Nothing checked it against promo_codes — and the id was visible
    // in the URL (/checkout?coupon=…), so anyone could lift one from a shared
    // link and apply it to their own purchase. Every guard the promo system has
    // (max_uses, expires_at, plan_target, one-redemption-per-user) was
    // bypassable; they only ever gated the /pricing box, not the charge.
    //
    // Now the client sends the CODE and the server re-derives everything. The
    // authoritative check is that THIS user holds a redemption row for it, which
    // /api/promo/redeem creates behind a UNIQUE(code_id, user_id) constraint.
    const promoCode: string | undefined =
      typeof body.promoCode === "string" && body.promoCode.trim()
        ? body.promoCode.toUpperCase().trim()
        : undefined;

    let couponId: string | undefined;
    let promoFreeDays: number | undefined;
    if (promoCode) {
      // promo_codes / promo_code_redemptions are service-role only (RLS on, no
      // client policy), so this must not use the caller's session client.
      const admin = getAdminSupabase();
      const { data: promo } = await admin
        .from("promo_codes")
        .select("id, discount_type, free_days, stripe_coupon_id, active, expires_at, max_uses, uses_count, plan_target")
        .eq("code", promoCode)
        .eq("active", true)
        .maybeSingle();

      // Every failure below is silent: the purchase proceeds at full price
      // rather than erroring. A promo that quietly doesn't apply is a support
      // ticket; a checkout that refuses to complete is a lost sale.
      const usable =
        !!promo &&
        (!promo.expires_at || new Date(promo.expires_at as string) > new Date()) &&
        (promo.max_uses == null || (promo.uses_count as number) < (promo.max_uses as number));

      if (usable) {
        // Did this user actually redeem it? Without this, knowing the string is
        // enough — which is exactly the hole we're closing.
        const { data: redemption } = await admin
          .from("promo_code_redemptions")
          .select("id")
          .eq("code_id", promo!.id as string)
          .eq("user_id", user.id)
          .maybeSingle();

        if (redemption) {
          if (promo!.discount_type === "free_time" && isFreeDays(Number(promo!.free_days))) {
            promoFreeDays = Number(promo!.free_days);
          } else if (promo!.stripe_coupon_id) {
            couponId = promo!.stripe_coupon_id as string;
          }
        }
      }
    }

    // Resolve the price from EITHER an explicit priceId (legacy callers) OR a
    // {plan, interval} pair resolved server-side (the unified /checkout flow), so
    // the price↔plan mapping lives in one place (lib/subscription) and can't drift.
    const interval: BillingInterval = body.interval === "annual" ? "annual" : "monthly";
    let priceId: string;
    if (typeof body.priceId === "string" && body.priceId) {
      priceId = body.priceId;
    } else if (body.plan === "pro" || body.plan === "office") {
      const resolved = priceIdForPlan(body.plan, interval);
      if (!resolved) return NextResponse.json({ error: "That plan isn't available right now." }, { status: 400 });
      priceId = resolved;
    } else {
      priceId = process.env.STRIPE_PRICE_ID!;
    }

    // Only sell prices we actually offer.
    const isOffice = OFFICE_PRICE_IDS.includes(priceId);
    const isPro = PRO_PRICE_IDS.includes(priceId);
    if (!isOffice && !isPro) {
      return NextResponse.json({ error: "Unknown plan price." }, { status: 400 });
    }

    // Seats: Office is per-seat with a minimum; Pro is always a single seat.
    const requestedQty = typeof body.quantity === "number" ? Math.floor(body.quantity)
      : typeof body.seats === "number" ? Math.floor(body.seats) : 1;
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

    // Opt-in Pro trial (TRIAL_DAYS) for FIRST-TIME subscribers only. The card is
    // collected at checkout and Stripe bills automatically when the trial ends
    // unless they cancel. A customer who has ever had a subscription (active,
    // canceled, or trialing) gets no second trial.
    //
    // `trial: false` opts OUT. The trial is a public-pricing-page acquisition
    // offer; an in-product upgrade (someone already using SwiftCard on Free)
    // starts and pays. Only ever narrows eligibility — a client asking for a
    // trial it isn't entitled to is still refused by the hadSub check below, so
    // this flag can't be abused to mint one.
    const trialAllowed = body.trial !== false;
    let trialDays: number | undefined;
    if (isPro && trialAllowed) {
      let hadSub = false;
      if (profile.stripe_customer_id) {
        try {
          const prior = await stripe.subscriptions.list({ customer: profile.stripe_customer_id as string, status: "all", limit: 1 });
          hadSub = prior.data.length > 0;
        } catch {
          hadSub = true; // can't verify → err on the side of not granting a trial
        }
      }
      if (!hadSub) trialDays = TRIAL_DAYS;
    }

    // ── Free-time promo → a trial, not a coupon ──────────────────────────────
    // "One week free" cannot be a Stripe coupon (coupon duration is whole months
    // only), so a free-time code buys trial days instead. It applies to BOTH Pro
    // and Office — an Office buyer given a free month should get one.
    //
    // It overrides the standard 14-day Pro trial rather than stacking: the two
    // are the same mechanism, and Stripe takes a single trial_period_days. Max()
    // so a code can only ever be at least as good as what they'd have had — a
    // one-week code must never quietly shorten someone's 14-day trial.
    if (promoFreeDays) {
      trialDays = Math.max(trialDays ?? 0, promoFreeDays);
    }

    // Verify the real Stripe Price still matches what /pricing shows before
    // charging anyone — catches a mispriced or archived Product in the dashboard.
    const expectedCents = EXPECTED_CENTS[priceId];
    if (expectedCents !== undefined) {
      const price = await stripe.prices.retrieve(priceId);
      if (!price.active || price.currency !== "usd" || price.unit_amount !== expectedCents) {
        console.error("Stripe price mismatch:", { priceId, expectedCents, unitAmount: price.unit_amount, currency: price.currency, active: price.active });
        return NextResponse.json({ error: "This plan's price is temporarily unavailable. Please try again shortly or contact support." }, { status: 409 });
      }
    }

    // Post-payment landing. A caller may pass an explicit same-origin successPath
    // (the legacy /welcome flow does); otherwise route through /checkout/success,
    // which enforces card creation before the dashboard/office (spec §3).
    const planKey = isOffice ? "office" : "pro";
    const rawSuccess = typeof body.successPath === "string" ? body.successPath : "";
    const successPath =
      rawSuccess.startsWith("/") && !rawSuccess.startsWith("//") && /^\/[a-zA-Z0-9?=&_.\-/]*$/.test(rawSuccess)
        ? rawSuccess
        : `/checkout/success?plan=${planKey}`;
    // Cancel returns to the checkout page with the SAME selection preserved, so a
    // canceled/abandoned checkout can be retried without re-choosing (spec §1).
    const cancelPath = `/checkout?plan=${planKey}&interval=${interval}${isOffice ? `&seats=${quantity}` : ""}&canceled=1`;

    const session = await stripe.checkout.sessions.create({
      client_reference_id: user.id,
      // Reuse the existing Stripe customer so re-subscribing doesn't create duplicates.
      ...(profile.stripe_customer_id
        ? { customer: profile.stripe_customer_id as string }
        : { customer_email: profile.email }),
      line_items: [{ price: priceId, quantity }],
      mode: "subscription",
      // First-time Pro subscribers start with a free trial, then auto-bill.
      ...(trialDays ? { subscription_data: { trial_period_days: trialDays } } : {}),
      // Record the seat count so the webhook provisions the office reliably.
      ...(isOffice ? { metadata: { seats: String(quantity) } } : {}),
      success_url: `${APP_URL}${successPath}`,
      cancel_url: `${APP_URL}${cancelPath}`,
      // Either a pre-applied coupon OR a promo-code box (Stripe forbids both):
      // with no coupon, customers can type admin-created promo codes at checkout.
      ...(couponId ? { discounts: [{ coupon: couponId }] } : { allow_promotion_codes: true }),
    }, {
      // Idempotency: a double-click (or a retried request) within the same minute
      // returns the SAME Checkout Session instead of creating a duplicate.
      idempotencyKey: `checkout:${user.id}:${priceId}:${quantity}:${Math.floor(Date.now() / 60000)}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
