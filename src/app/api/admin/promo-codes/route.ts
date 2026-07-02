import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

async function requireAdmin(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) return null;
  return user;
}

// POST /api/admin/promo-codes — create a new promo code
export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    code,
    description,
    discount_percent,
    discount_type = "percent",
    discount_amount,
    max_uses,
    expires_at,
    plan_target = "free",
    stripe_coupon_id,
  } = body;

  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });
  if (!discount_percent && !discount_amount) {
    return NextResponse.json({ error: "discount_percent or discount_amount required" }, { status: 400 });
  }

  const cleanCode = code.toUpperCase().trim();

  // Make the code REAL: create a matching Stripe coupon + promotion code so
  // customers can type it on the Stripe checkout page (allow_promotion_codes).
  let couponId: string | null = stripe_coupon_id ?? null;
  let stripeWarning: string | null = null;
  if (!couponId) {
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
    discount_percent,
    discount_type,
    discount_amount,
    max_uses,
    expires_at: expires_at || null,
    plan_target,
    stripe_coupon_id: couponId,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promo: data, stripeWarning });
}

// GET /api/admin/promo-codes — list all promo codes
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codes: data });
}

// DELETE /api/admin/promo-codes?id=<id> — delete a promo code
export async function DELETE(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = getAdminSupabase();

  // Deactivate the matching Stripe promotion code too (best effort) so a
  // deleted code stops working at checkout as well.
  const { data: promo } = await admin.from("promo_codes").select("code").eq("id", id).maybeSingle();
  if (promo?.code) {
    try {
      const { getStripe } = await import("@/lib/stripe");
      const stripe = getStripe();
      const list = await stripe.promotionCodes.list({ code: promo.code as string, limit: 1 });
      const pc = list.data[0];
      if (pc && pc.active) await stripe.promotionCodes.update(pc.id, { active: false });
    } catch {
      /* Stripe cleanup is best-effort */
    }
  }

  const { error } = await admin.from("promo_codes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
