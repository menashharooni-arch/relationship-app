import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Opens the Stripe customer portal on the account's DEFAULT configuration —
// i.e. whatever is set at Settings → Billing → Customer portal in the Stripe
// Dashboard. Deliberately no `configuration` override.
//
// This used to pass a custom API-built configuration that scoped the portal to
// payment method + invoices. Two problems with that:
//   • it suppressed Stripe's own cancellation-reason survey (on by default), and
//   • retention coupons CANNOT be set on an API-built configuration at all —
//     Stripe only supports them on the Dashboard-managed default config.
// So the questions and the save-offer both live in the Dashboard now, where
// they can be tuned without a deploy. Nothing here needs to change to add,
// remove or re-price a retention coupon.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found for this user." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${APP_URL}/settings/flows`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
