import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin";
import { FREE_PERIODS, isFreeDays, isDiscountType } from "@/lib/promo";

// POST /api/admin/promo-codes — create a new promo code
export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    code,
    description,
    discount_percent,
    discount_type = "free_time",
    discount_amount,
    free_days,
    max_uses,
    expires_at,
    plan_target = "free",
    stripe_coupon_id,
  } = body;

  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });
  if (!isDiscountType(discount_type)) {
    return NextResponse.json({ error: "Unknown discount type." }, { status: 400 });
  }

  const isFreeTime = discount_type === "free_time";

  // ── Validate the offer BEFORE anything is created ───────────────────────────
  // A typo'd value (150%, negative, a 9-month "free trial") must never persist
  // locally even when Stripe rejects it — that leaves an over-generous or broken
  // code sitting in promo_codes looking legitimate.
  if (isFreeTime) {
    if (!isFreeDays(Number(free_days))) {
      return NextResponse.json(
        { error: `Free period must be one of: ${FREE_PERIODS.map((p) => p.label.toLowerCase()).join(", ")}.` },
        { status: 400 },
      );
    }
  } else {
    if (!discount_percent && !discount_amount) {
      return NextResponse.json({ error: "discount_percent or discount_amount required" }, { status: 400 });
    }
    if (discount_percent != null && !(Number(discount_percent) > 0 && Number(discount_percent) <= 100)) {
      return NextResponse.json({ error: "discount_percent must be between 1 and 100" }, { status: 400 });
    }
    if (discount_amount != null && !(Number(discount_amount) > 0 && Number(discount_amount) <= 100_00)) {
      return NextResponse.json({ error: "discount_amount must be 1–10000 cents ($100 max)" }, { status: 400 });
    }
  }

  const cleanCode = code.toUpperCase().trim();

  // ── Make the code real in Stripe ────────────────────────────────────────────
  // percent/fixed → a Stripe coupon + promotion code, so it can also be typed on
  // Stripe's own checkout page (allow_promotion_codes).
  //
  // free_time → NO coupon. Free time is a trial (trial_period_days), and Stripe
  // coupons can't express it: their duration is whole months only, so "one week
  // free" is not a coupon anyone can build. The checkout route resolves the code
  // to a trial instead. That also means a free-time code can't be typed on
  // Stripe's page — it's redeemed in the SwiftCard promo box on /pricing, which
  // is where the plan/expiry/usage rules can actually be enforced.
  let couponId: string | null = stripe_coupon_id ?? null;
  let stripeWarning: string | null = null;
  if (!isFreeTime && !couponId) {
    try {
      const { getStripe } = await import("@/lib/stripe");
      const stripe = getStripe();
      const coupon = await stripe.coupons.create({
        name: `SwiftCard ${cleanCode}`,
        duration: "once", // discount applies to the first payment
        ...(discount_type === "fixed" && discount_amount
          ? { amount_off: Number(discount_amount), currency: "usd" }
          : { percent_off: Number(discount_percent) }),
      });
      await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon: coupon.id },
        code: cleanCode,
        ...(max_uses ? { max_redemptions: Number(max_uses) } : {}),
        ...(expires_at ? { expires_at: Math.floor(new Date(expires_at).getTime() / 1000) } : {}),
      });
      couponId = coupon.id;
    } catch (e) {
      // Still save the code, but be honest that it isn't redeemable at checkout.
      stripeWarning = `Code saved, but Stripe rejected it (${e instanceof Error ? e.message : e}) — it won't work at checkout.`;
    }
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin.from("promo_codes").insert({
    code: cleanCode,
    description,
    discount_percent: isFreeTime ? null : discount_percent,
    discount_type,
    discount_amount: isFreeTime ? null : discount_amount,
    free_days: isFreeTime ? Number(free_days) : null,
    max_uses,
    expires_at: expires_at || null,
    plan_target,
    stripe_coupon_id: couponId,
  }).select().single();

  if (error) {
    // The free_days column + the widened discount_type CHECK arrive in
    // supabase/promo-free-time.sql. Say so rather than surfacing raw Postgres.
    if (isFreeTime && /free_days|discount_type|check constraint/i.test(error.message)) {
      return NextResponse.json(
        { error: "Free-time codes need the promo-free-time.sql migration run first (Supabase → SQL Editor)." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ promo: data, stripeWarning });
}

// GET /api/admin/promo-codes — list ACTIVE promo codes (the working set the
// admin can send/manage). Deactivated codes live in the log endpoint.
export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("promo_codes")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codes: data });
}

// DELETE /api/admin/promo-codes?id=<id> — deactivate a promo code EVERYWHERE.
//
// This is deliberately a SOFT delete (active=false), not a row delete:
// - every redemption path filters on active=true (redeem, checkout resolve),
//   so the code stops working for everyone the moment this lands;
// - promo_code_redemptions has ON DELETE CASCADE — a hard delete would wipe
//   who used the code AND drop the single-use guard, so recreating the same
//   string would let past redeemers use it again;
// - the row is the promo log ("what we sent, when, how long it was active").
export async function DELETE(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = getAdminSupabase();

  // Kill the code on Stripe's own checkout page too. allow_promotion_codes
  // means a code typed at Stripe bypasses our DB entirely, so EVERY matching
  // active promotion code must be turned off — and a failure is reported, not
  // swallowed (a silently-still-working "deleted" code is the worst outcome).
  let stripeWarning: string | null = null;
  const { data: promo } = await admin.from("promo_codes").select("code, active").eq("id", id).maybeSingle();
  if (!promo) return NextResponse.json({ error: "Promo code not found" }, { status: 404 });
  try {
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe();
    const list = await stripe.promotionCodes.list({ code: promo.code as string, limit: 100 });
    for (const pc of list.data) {
      if (pc.active) await stripe.promotionCodes.update(pc.id, { active: false });
    }
  } catch (e) {
    stripeWarning = `Deactivated in SwiftCard, but Stripe cleanup failed (${e instanceof Error ? e.message : e}). If this code has a Stripe coupon, disable it in the Stripe dashboard too.`;
  }

  // Stamp when it was turned off (for the "how long was it active" log).
  // deactivated_at arrives with supabase/promo-deactivated-at.sql — fall back
  // to just active=false if the column isn't there yet.
  let { error } = await admin
    .from("promo_codes")
    .update({ active: false, deactivated_at: new Date().toISOString() })
    .eq("id", id);
  if (error && /deactivated_at/i.test(error.message)) {
    ({ error } = await admin.from("promo_codes").update({ active: false }).eq("id", id));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, stripeWarning });
}
