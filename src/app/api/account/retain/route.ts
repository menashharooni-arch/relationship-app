import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { officeSubUserBlockMessage } from "@/lib/office-roles";

// Called when a paid user accepts the "stay and get a free month" retention offer.
// Applies a retention coupon to their subscription if one is configured.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Office sub-users have no personal subscription to manage — billing is
  // the organization's. A delegated billing_admin passes through.
  const subBlocked = await officeSubUserBlockMessage(user.id, {
    unless: "manage_billing",
    message: "Billing for your account is managed by your organization.",
  });
  if (subBlocked) return NextResponse.json({ error: subBlocked }, { status: 403 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id, customization")
    .eq("id", user.id)
    .single();

  const isPro = profile?.plan === "pro" || profile?.plan === "enterprise";
  const couponId = process.env.STRIPE_RETENTION_COUPON_ID;

  // Once per customer, exactly like /api/stripe/subscription/discount. Without
  // this a paid user could POST here every cycle and re-apply the free-month
  // coupon forever — a perpetual discount they were never offered. (security
  // audit MED) The flag lives in the server-owned `_retentionUsed` key.
  const cust = (profile?.customization as Record<string, unknown> | null) ?? {};
  if (cust._retentionUsed === true) {
    return NextResponse.json({ error: "already_used", message: "You've already used your retention offer." }, { status: 409 });
  }

  if (isPro && couponId && profile?.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.update(profile.stripe_subscription_id, { discounts: [{ coupon: couponId }] });
      await admin.from("profiles").update({ customization: { ...cust, _retentionUsed: true } }).eq("id", user.id);
    } catch {
      /* ignore — they still keep their account (coupon not consumed, flag not set) */
    }
  }

  return NextResponse.json({ ok: true });
}
