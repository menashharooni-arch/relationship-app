import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { receiptEmail } from "@/lib/email-templates";
import { rewardReferrerIfEligible } from "@/lib/referral-server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

async function sendReceiptForUser(opts: {
  userId: string;
  planName: string;
  amountCents: number;
  interval: string;
  invoiceId?: string | null;
}) {
  const admin = getAdminSupabase();

  const [{ data: profile }, { data: prefs }] = await Promise.all([
    admin.from("profiles").select("name, email").eq("id", opts.userId).single(),
    admin.from("email_preferences").select("receipt_emails").eq("user_id", opts.userId).single(),
  ]);

  if (!profile?.email || prefs?.receipt_emails === false) return;

  const firstName = profile.name?.split(" ")[0] || "there";
  const amount = `$${(opts.amountCents / 100).toFixed(2)}`;
  const invoiceNum = `SC-${Date.now().toString().slice(-8)}`;

  const template = receiptEmail({
    firstName,
    email: profile.email,
    planName: opts.planName,
    amount,
    interval: opts.interval,
    paymentDate: new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    }),
    invoiceNumber: invoiceNum,
    invoiceUrl: opts.invoiceId
      ? `https://dashboard.stripe.com/invoices/${opts.invoiceId}`
      : undefined,
    manageUrl: `${APP_URL}/settings`,
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: sent } = await resend.emails.send({ ...template, to: profile.email });

  await admin.from("email_logs").insert({
    user_id: opts.userId,
    email: profile.email,
    type: "receipt",
    subject: template.subject,
    resend_id: sent?.id,
  });
}

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

  // ── First checkout / upgrade ─────────────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    if (userId) {
      const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 1 });
      const priceId = lineItems.data[0]?.price?.id;
      const enterprisePriceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID;
      const isEnterprise = priceId === enterprisePriceId;
      const plan = isEnterprise ? "enterprise" : "pro";
      const seats = isEnterprise
        ? (session.metadata?.seats ? parseInt(session.metadata.seats) : (lineItems.data[0]?.quantity ?? 5))
        : 1;

      const admin = getAdminSupabase();
      await admin.from("profiles").update({
        plan,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan_expires_at: null, // now a real paying customer — no free-month downgrade
      }).eq("id", userId);

      // Referral: the friend just became a PAYING customer — grant the referrer
      // their one-time reward (verified Stripe event, never from the browser).
      try {
        await rewardReferrerIfEligible(userId);
      } catch (e) {
        console.error("Referral reward error:", e);
      }

      // Send receipt
      try {
        await sendReceiptForUser({
          userId,
          planName: plan.charAt(0).toUpperCase() + plan.slice(1),
          amountCents: session.amount_total ?? 0,
          interval: "Monthly",
          invoiceId: session.invoice as string | null,
        });
      } catch (e) {
        console.error("Receipt email error:", e);
      }

      // Auto-create office for enterprise
      if (isEnterprise) {
        const { data: existing } = await admin.from("offices").select("id").eq("owner_id", userId).single();
        if (!existing) {
          const { data: profile } = await admin.from("profiles").select("name, company").eq("id", userId).single();
          const officeName =
            (profile as { company?: string } | null)?.company ||
            (profile as { name?: string } | null)?.name ||
            "My Office";
          await admin.from("offices").insert({ name: officeName, owner_id: userId, seats });
        } else {
          await admin.from("offices").update({ seats }).eq("id", existing.id);
        }
      }
    }
  }

  // ── Recurring billing — send receipt on every renewal ────────────────────────
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    // Skip the very first invoice — checkout.session.completed handles that
    if (invoice.billing_reason === "subscription_cycle" && invoice.customer) {
      const admin = getAdminSupabase();
      const { data: profile } = await admin
        .from("profiles")
        .select("id, plan")
        .eq("stripe_customer_id", invoice.customer as string)
        .single();

      if (profile?.id) {
        try {
          await sendReceiptForUser({
            userId: profile.id,
            planName: (profile.plan as string ?? "Pro").charAt(0).toUpperCase() + (profile.plan as string ?? "pro").slice(1),
            amountCents: invoice.amount_paid,
            interval: "Monthly renewal",
            invoiceId: invoice.id,
          });
        } catch (e) {
          console.error("Renewal receipt error:", e);
        }
      }
    }
  }

  // ── Cancellation ─────────────────────────────────────────────────────────────
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const admin2 = getAdminSupabase();
    const { data: profile } = await admin2.from("profiles")
      // Clear the subscription id + any free-month expiry so the row can't later
      // be mistaken for an active subscriber (which would leak Pro forever).
      .update({ plan: "free", plan_expires_at: null, stripe_subscription_id: null })
      .eq("stripe_subscription_id", sub.id)
      .select("id")
      .single();

    if (profile?.id) {
      const admin = getAdminSupabase();
      const { data: office } = await admin.from("offices").select("id").eq("owner_id", profile.id).single();
      if (office) {
        const { data: activeMembers } = await admin
          .from("office_members")
          .select("user_id")
          .eq("office_id", office.id)
          .eq("status", "active")
          .not("user_id", "is", null);

        for (const m of activeMembers ?? []) {
          if (m.user_id) {
            await admin.from("profiles").update({ plan: "free", office_id: null, plan_expires_at: null }).eq("id", m.user_id);
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
