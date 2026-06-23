import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";
import { getAdminSupabase } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = getSupabase();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    if (userId) {
      // Determine plan from the price ID
      const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 1 });
      const priceId = lineItems.data[0]?.price?.id;
      const enterprisePriceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID;
      const isEnterprise = priceId === enterprisePriceId;
      const plan = isEnterprise ? "enterprise" : "pro";
      const seats = isEnterprise ? (session.metadata?.seats ? parseInt(session.metadata.seats) : (lineItems.data[0]?.quantity ?? 5)) : 1;

      await supabase.from("profiles").update({
        plan,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
      }).eq("id", userId);

      // Auto-create office for enterprise admins if they don't have one yet
      if (isEnterprise) {
        const admin = getAdminSupabase();
        const { data: existing } = await admin.from("offices").select("id").eq("owner_id", userId).single();
        if (!existing) {
          const { data: profile } = await admin.from("profiles").select("name, company").eq("id", userId).single();
          const officeName = (profile as { company?: string } | null)?.company || (profile as { name?: string } | null)?.name || "My Office";
          await admin.from("offices").insert({ name: officeName, owner_id: userId, seats });
        } else {
          await admin.from("offices").update({ seats }).eq("id", existing.id);
        }
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    // Revert main profile
    const { data: profile } = await supabase.from("profiles")
      .update({ plan: "free" })
      .eq("stripe_subscription_id", sub.id)
      .select("id")
      .single();

    // Revert all office members if this was an enterprise account
    if (profile?.id) {
      const admin = getAdminSupabase();
      const { data: office } = await admin.from("offices").select("id").eq("owner_id", profile.id).single();
      if (office) {
        // Revert all active members to free
        const { data: activeMembers } = await admin
          .from("office_members")
          .select("user_id")
          .eq("office_id", office.id)
          .eq("status", "active")
          .not("user_id", "is", null);

        for (const m of activeMembers ?? []) {
          if (m.user_id) {
            await admin.from("profiles").update({ plan: "free", office_id: null }).eq("id", m.user_id);
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
