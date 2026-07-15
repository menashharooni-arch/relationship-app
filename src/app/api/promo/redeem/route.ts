import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isRateLimited } from "@/lib/rate-limit";

// POST /api/promo/redeem — user redeems a promo code
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Promo codes are short admin-typed strings, not high-entropy tokens —
  // cap guesses per account.
  if (await isRateLimited(`promo-redeem:${user.id}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts — try again in a few minutes." }, { status: 429 });
  }

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const admin = getAdminSupabase();

  // Look up code
  const { data: promo, error: promoErr } = await admin
    .from("promo_codes")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("active", true)
    .single();

  if (promoErr || !promo) {
    return NextResponse.json({ error: "Invalid or expired promo code" }, { status: 404 });
  }

  // Check expiry
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return NextResponse.json({ error: "This promo code has expired" }, { status: 410 });
  }

  // Check uses cap
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
    return NextResponse.json({ error: "This promo code has reached its usage limit" }, { status: 410 });
  }

  // Check if user already redeemed it
  const { data: existing } = await admin
    .from("promo_code_redemptions")
    .select("id")
    .eq("code_id", promo.id)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "You have already used this promo code" }, { status: 409 });
  }

  // Check plan_target eligibility
  if (promo.plan_target !== "all") {
    const { data: profile } = await admin
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = (profile as { plan?: string } | null)?.plan ?? "free";
    if (promo.plan_target === "free" && plan !== "free") {
      return NextResponse.json({ error: "This code is only for free-plan users" }, { status: 403 });
    }
    if (promo.plan_target === "pro" && plan === "free") {
      return NextResponse.json({ error: "This code is only for Pro users" }, { status: 403 });
    }
  }

  // Record the redemption. The UNIQUE(code_id, user_id) constraint is the
  // authoritative single-use guard: even under concurrent requests only ONE
  // insert can succeed, so a code can never be redeemed twice by the same user
  // (the pre-check above is a fast path; this closes the race window).
  const { error: redeemErr } = await admin
    .from("promo_code_redemptions")
    .insert({ code_id: promo.id, user_id: user.id });

  if (redeemErr) {
    if (redeemErr.code === "23505") {
      // Unique violation → already redeemed. Never hand out the reward twice.
      return NextResponse.json({ error: "You have already used this promo code" }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not redeem this code. Please try again." }, { status: 500 });
  }

  // Only now — after the redemption is durably recorded — bump the usage count,
  // so a duplicate/failed attempt can never inflate it.
  await admin.from("promo_codes").update({ uses_count: promo.uses_count + 1 }).eq("id", promo.id);

  // NOTE: stripe_coupon_id is deliberately NOT returned any more. It used to be,
  // and the client then handed it to /api/stripe/checkout, which passed it
  // straight to Stripe unvalidated — so a coupon id lifted from the URL of a
  // shared checkout link applied to anyone's purchase, bypassing max_uses,
  // expiry, plan_target and the per-user single-use rule. Checkout now takes the
  // CODE and re-resolves it server-side; the client never sees a Stripe id.
  return NextResponse.json({
    success: true,
    promo: {
      code: promo.code,
      description: promo.description,
      discount_type: promo.discount_type,
      discount_percent: promo.discount_percent,
      discount_amount: promo.discount_amount,
      free_days: promo.free_days ?? null,
    },
  });
}
