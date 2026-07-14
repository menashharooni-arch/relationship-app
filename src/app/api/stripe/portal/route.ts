import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";
import { getPortalConfigurationId } from "@/lib/stripe-portal";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

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
    // Scope the portal to payment method + invoices so it can't offer a cancel
    // that skips the retention flow. If the configuration can't be resolved,
    // still open the portal: someone with a failed payment must always be able
    // to fix their card, and cancelling is reachable from our own UI anyway.
    const configuration = await getPortalConfigurationId().catch(() => null);
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${APP_URL}/settings/flows`,
      ...(configuration ? { configuration } : {}),
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
