import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";

// Called when a paid user accepts the "stay and get a free month" retention offer.
// Applies a retention coupon to their subscription if one is configured.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  const isPro = profile?.plan === "pro" || profile?.plan === "enterprise";
  const couponId = process.env.STRIPE_RETENTION_COUPON_ID;

  if (isPro && couponId && profile?.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.update(profile.stripe_subscription_id, { discounts: [{ coupon: couponId }] });
    } catch {
      /* ignore — they still keep their account */
    }
  }

  return NextResponse.json({ ok: true });
}
