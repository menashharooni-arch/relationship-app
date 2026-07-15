import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { receiptEmail, paymentFailedEmail } from "@/lib/email-templates";
import { markReferralConversion } from "@/lib/referral-server";
import { getAccountEmail } from "@/lib/account-email";
import { getOfficeBrand, stripBrandFromUserCards, memberFallbackPlan } from "@/lib/office-brand";
import { planFromPriceId } from "@/lib/subscription";
import { PLAN_LIMITS } from "@/lib/plan";
import { isDuplicateStripeEvent, clearStripeEvent } from "@/lib/stripe-idempotency";
import { reportError } from "@/lib/report-error";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

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

  // Receipt goes to the ACCOUNT (auth) email, not profiles.email (which can be
  // the card's public contact address).
  const accountEmail = await getAccountEmail(opts.userId, profile?.email ?? null);
  if (!profile || !accountEmail || prefs?.receipt_emails === false) return;

  const firstName = profile.name?.split(" ")[0] || "there";
  const amount = `$${(opts.amountCents / 100).toFixed(2)}`;
  const invoiceNum = `SC-${Date.now().toString().slice(-8)}`;

  const template = receiptEmail({
    firstName,
    email: accountEmail,
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
    manageUrl: `${APP_URL}/settings/flows?billing=1`,
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: sent } = await resend.emails.send({ ...template, to: accountEmail });

  await admin.from("email_logs").insert({
    user_id: opts.userId,
    email: accountEmail,
    type: "receipt",
    subject: template.subject,
    resend_id: sent?.id,
  });
}

async function sendPaymentFailedEmail(opts: { customerId: string; amountCents: number }) {
  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, email, plan")
    .eq("stripe_customer_id", opts.customerId)
    .single();

  if (!profile) return;
  // Owner mail goes to the ACCOUNT (auth) email, not profiles.email.
  const accountEmail = await getAccountEmail(profile.id as string, (profile.email as string) ?? null);
  if (!accountEmail) return;

  const firstName = (profile.name as string)?.split(" ")[0] || "there";
  const planName = ((profile.plan as string) || "Pro").charAt(0).toUpperCase() + ((profile.plan as string) || "pro").slice(1);
  const template = paymentFailedEmail({
    firstName,
    planName,
    amount: `$${(opts.amountCents / 100).toFixed(2)}`,
    manageUrl: `${APP_URL}/settings/flows?billing=1`,
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: sent } = await resend.emails.send({ ...template, to: accountEmail });

  await admin.from("email_logs").insert({
    user_id: profile.id,
    email: accountEmail,
    type: "payment_failed",
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

  // Idempotency: Stripe redelivers events (and retries after our 500s), so skip
  // anything we've already processed to avoid double receipts / double cascades.
  if (await isDuplicateStripeEvent(event.id, event.type)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Everything past signature verification runs inside a guard: an unexpected
  // failure while provisioning a plan / cascading a downgrade is a money-and-
  // access event, so we alert AND return 500 so Stripe retries the delivery
  // rather than dropping it silently.
  try {
  // ── First checkout / upgrade ─────────────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    if (userId) {
      const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 1 });
      const priceId = lineItems.data[0]?.price?.id;
      // Recognise BOTH the monthly AND annual Office prices — matching only the
      // monthly one silently provisioned annual Office buyers as Pro.
      const mapped = planFromPriceId(priceId);
      // An unmapped price silently falling through to "pro" reintroduces the
      // exact "annual Office provisioned as Pro" bug when an env price var is
      // missing at runtime — alert instead of guessing. (billing audit #10)
      if (!mapped) {
        await reportError("stripe.webhook.unmapped_price", new Error(`Unmapped checkout price ${priceId}`), { eventId: event.id, priceId });
      }
      const isEnterprise = mapped?.plan === "office";
      const plan = isEnterprise ? "enterprise" : "pro";
      const seats = isEnterprise
        ? (session.metadata?.seats ? parseInt(session.metadata.seats) : (lineItems.data[0]?.quantity ?? PLAN_LIMITS.OFFICE_MIN_SEATS))
        : 1;

      // Card fingerprint for referral fraud dedup (same card on two accounts).
      let paymentFingerprint: string | null = null;
      try {
        if (session.subscription) {
          const sub = await getStripe().subscriptions.retrieve(session.subscription as string, { expand: ["default_payment_method"] });
          const pm = sub.default_payment_method as Stripe.PaymentMethod | null;
          paymentFingerprint = pm?.card?.fingerprint ?? null;
        }
      } catch (e) {
        console.error("[stripe] payment fingerprint fetch failed:", e);
      }

      const admin = getAdminSupabase();
      // Guard against double-billing: if this customer already had a DIFFERENT
      // active subscription (e.g. clicked upgrade twice, or switched plans by
      // starting a new Checkout instead of using the billing portal), cancel
      // the old one now that the new one is confirmed active. Never cancel the
      // subscription we're about to write (defends against Stripe redelivering
      // this same event).
      const { data: priorProfile } = await admin
        .from("profiles")
        .select("stripe_subscription_id")
        .eq("id", userId)
        .single();
      const priorSubId = priorProfile?.stripe_subscription_id as string | null | undefined;
      if (priorSubId && priorSubId !== session.subscription) {
        try {
          await getStripe().subscriptions.cancel(priorSubId);
        } catch (e) {
          console.error("[stripe] failed to cancel superseded subscription:", e);
        }
      }
      // Critical: upgrade the plan. Kept to pre-existing columns ONLY so it can
      // never be blocked by a not-yet-run REFERRAL_SETUP.sql migration.
      await admin.from("profiles").update({
        plan,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
      }).eq("id", userId);
      // Referral columns (added by the migration) — best-effort; a missing column
      // just no-ops here and never affects the upgrade above.
      await admin.from("profiles").update({
        plan_expires_at: null, // a real paying customer — no free-month downgrade
        ...(paymentFingerprint ? { payment_fingerprint: paymentFingerprint } : {}),
      }).eq("id", userId);

      // Referral: the friend just became a PAYING customer — grant the referrer
      // their one-time reward (verified Stripe event, never from the browser).
      try {
        await markReferralConversion(userId);
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
    if (invoice.customer) {
      const admin = getAdminSupabase();
      const { data: profile } = await admin
        .from("profiles")
        .select("id, plan, customization")
        .eq("stripe_customer_id", invoice.customer as string)
        .single();

      if (profile?.id) {
        // Payment recovered — clear the grace-period clock so a future failure
        // starts fresh instead of inheriting an already-elapsed window. Cleared
        // on ANY successful invoice for this customer (not just renewals) —
        // e.g. the very first invoice retrying after a decline, or a seat-count
        // update invoice — otherwise a stale clock survives and the reminders
        // cron can cancel a customer who is actively paying.
        const cust = (profile.customization ?? {}) as Record<string, unknown>;
        if (cust._paymentFailedAt) {
          const rest = { ...cust };
          delete rest._paymentFailedAt;
          await admin.from("profiles").update({ customization: rest }).eq("id", profile.id);
        }
      }

      // Skip the very first invoice — checkout.session.completed sends that receipt.
      if (invoice.billing_reason === "subscription_cycle" && profile?.id) {
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

  // ── Failed renewal charge — start a 7-day grace period ───────────────────────
  // The customer keeps full access for 7 days to fix their payment method. The
  // daily reminders cron (/api/reminders) checks _paymentFailedAt and cancels
  // the subscription (triggering the downgrade below) if it's still unresolved
  // after 7 days. A recovered payment (invoice.payment_succeeded, above) clears
  // the clock. Stripe's own Smart Retries may also exhaust and cancel first —
  // either path lands on customer.subscription.deleted, which downgrades.
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.customer) {
      try {
        await sendPaymentFailedEmail({
          customerId: invoice.customer as string,
          amountCents: invoice.amount_due,
        });
      } catch (e) {
        console.error("Payment-failed email error:", e);
      }
      try {
        const admin = getAdminSupabase();
        const { data: profile } = await admin
          .from("profiles")
          .select("id, customization")
          .eq("stripe_customer_id", invoice.customer as string)
          .single();
        if (profile?.id) {
          const cust = (profile.customization ?? {}) as Record<string, unknown>;
          // Only set on the FIRST failure for this billing cycle — a later retry
          // failing again must not push the deadline back out.
          if (!cust._paymentFailedAt) {
            await admin.from("profiles").update({
              customization: { ...cust, _paymentFailedAt: new Date().toISOString() },
            }).eq("id", profile.id);
          }
        }
      } catch (e) {
        console.error("Grace-period tracking error:", e);
      }
    }
  }

  // ── Subscription changed: cancel-scheduled, plan swap, or seat count ─────────
  // Fires for portal actions AND our own in-app endpoints; reconciles the DB so
  // the billing UI always reflects Stripe truth regardless of where the change
  // was made.
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const quantity = sub.items.data[0]?.quantity;
    const admin = getAdminSupabase();
    const { data: subProfile } = await admin
      .from("profiles")
      .select("id, plan, customization")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();

    if (subProfile?.id) {
      const cust = { ...((subProfile.customization as Record<string, unknown> | null) ?? {}) };
      let dirty = false;

      // 1) Mirror the scheduled-cancel state so the UI shows "cancels on <date>"
      //    + the Keep Subscription button, even when cancelled via the portal.
      const periodEndUnix = (sub as unknown as { current_period_end?: number }).current_period_end;
      const periodEndIso = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
      if (sub.cancel_at_period_end) {
        if (cust._cancelAtPeriodEnd !== true || cust._cancelAt !== periodEndIso) {
          cust._cancelAtPeriodEnd = true;
          cust._cancelAt = periodEndIso;
          dirty = true;
        }
      } else if (cust._cancelAtPeriodEnd) {
        delete cust._cancelAtPeriodEnd;
        delete cust._cancelAt;
        delete cust._cancelReason;
        dirty = true;
      }

      // 2) Reconcile the plan from the CURRENT price (a Pro↔Office swap done in
      //    the portal must not leave the DB on the old plan). Only while the sub
      //    is live (active/trialing/past_due) — a fully cancelled sub is handled
      //    by subscription.deleted.
      const mapped = planFromPriceId(sub.items.data[0]?.price?.id);
      const liveStatuses = ["active", "trialing", "past_due"];
      if (mapped && liveStatuses.includes(sub.status)) {
        const targetDbPlan = mapped.plan === "office" ? "enterprise" : "pro";
        if (subProfile.plan !== targetDbPlan) {
          await admin.from("profiles").update({ plan: targetDbPlan }).eq("id", subProfile.id);
          subProfile.plan = targetDbPlan;
        }
      }

      if (dirty) await admin.from("profiles").update({ customization: cust }).eq("id", subProfile.id);
    }

    if (quantity) {
      const profile = subProfile;
      if (profile?.id && profile.plan === "enterprise") {
        const { data: office } = await admin.from("offices").select("id").eq("owner_id", profile.id).single();
        if (office) {
          await admin.from("offices").update({ seats: quantity }).eq("id", office.id);
          // Seats reduced below current headcount (e.g. self-service downgrade
          // via the billing portal) — trim the most-recently-added active
          // members so paid seat count and actual access stay in sync. Without
          // this, shrinking seats only lowers the bill while every existing
          // member keeps enterprise access forever.
          const { data: activeMembers } = await admin
            .from("office_members")
            .select("id, user_id, created_at")
            .eq("office_id", office.id)
            .eq("status", "active")
            .not("user_id", "is", null)
            .order("created_at", { ascending: true });
          // The owner occupies seat 1, so a quantity of N leaves N−1 seats for
          // members. Keep the oldest N−1 active members and trim the rest.
          const memberSeats = Math.max(0, quantity - 1);
          const overflow = (activeMembers ?? []).slice(memberSeats);
          const trimBrand = overflow.length ? await getOfficeBrand(office.id).catch(() => null) : null;
          for (const m of overflow) {
            if (m.user_id) {
              // Members with their own live subscription revert to Pro, not
              // free — being trimmed from a team must not clobber a plan
              // they're still paying for. And their cards drop the office
              // brand (only fields still matching it).
              const fallback = await memberFallbackPlan(m.user_id);
              await admin.from("profiles").update({ plan: fallback, office_id: null }).eq("id", m.user_id);
              await admin.from("profiles").update({ plan_expires_at: null }).eq("id", m.user_id);
              await stripBrandFromUserCards(m.user_id, trimBrand).catch(() => {});
            }
            await admin.from("office_members").delete().eq("id", m.id);
          }
        }
      }
    }
  }

  // ── Cancellation ─────────────────────────────────────────────────────────────
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const admin2 = getAdminSupabase();
    // Critical downgrade (pre-existing columns only — never blocked by the migration).
    const { data: profile } = await admin2.from("profiles")
      .update({ plan: "free", stripe_subscription_id: null })
      .eq("stripe_subscription_id", sub.id)
      .select("id, customization")
      .single();
    // Best-effort: clear any free-month expiry so the row can't later be mistaken
    // for an active subscriber (which would leak Pro forever), and drop the
    // scheduled-cancel mirror (the cancellation has now happened).
    if (profile?.id) {
      const cust = { ...((profile.customization as Record<string, unknown> | null) ?? {}) };
      delete cust._cancelAtPeriodEnd;
      delete cust._cancelAt;
      delete cust._cancelReason;
      await admin2.from("profiles").update({ plan_expires_at: null, customization: cust }).eq("id", profile.id);
    }

    // If the person whose PERSONAL subscription just ended is still an active
    // member of someone else's PAID office, they remain entitled to enterprise
    // — the blanket downgrade above wrongly dropped them to free. Restore it
    // (keeping stripe_subscription_id null, since their own sub is gone) and
    // re-link the office. (billing audit #6B) The office-OWNER path below is
    // unaffected: an owner's own sub ending correctly cascades to members.
    if (profile?.id) {
      const { data: membership } = await admin2
        .from("office_members")
        .select("office_id")
        .eq("user_id", profile.id)
        .eq("status", "active")
        .maybeSingle();
      if (membership?.office_id) {
        const { data: owningOffice } = await admin2.from("offices").select("owner_id").eq("id", membership.office_id).maybeSingle();
        if (owningOffice?.owner_id) {
          const { data: ownerProfile } = await admin2.from("profiles").select("plan").eq("id", owningOffice.owner_id).maybeSingle();
          if (ownerProfile?.plan === "enterprise") {
            await admin2.from("profiles").update({ plan: "enterprise", office_id: membership.office_id }).eq("id", profile.id);
          }
        }
      }
    }

    if (profile?.id) {
      const admin = getAdminSupabase();
      const { data: office } = await admin.from("offices").select("id").eq("owner_id", profile.id).single();
      if (office) {
        const { data: activeMembers } = await admin
          .from("office_members")
          .select("id, user_id")
          .eq("office_id", office.id)
          .eq("status", "active")
          .not("user_id", "is", null);

        const cascadeBrand = (activeMembers ?? []).length ? await getOfficeBrand(office.id).catch(() => null) : null;
        for (const m of activeMembers ?? []) {
          if (m.user_id) {
            // Same rules as removal: own-subscription members land on Pro,
            // and the office brand comes off their cards.
            const fallback = await memberFallbackPlan(m.user_id);
            await admin.from("profiles").update({ plan: fallback, office_id: null }).eq("id", m.user_id);
            await admin.from("profiles").update({ plan_expires_at: null }).eq("id", m.user_id); // best-effort
            await stripBrandFromUserCards(m.user_id, cascadeBrand).catch(() => {});
          }
          // Remove the membership row itself (same as the owner's "Remove
          // member" action) — without this it stays status='active' forever,
          // and the office owner keeps seeing this ex-member's leads /
          // propagating brand onto their card if the subscription is later
          // reinstated or the member's card is reused.
          await admin.from("office_members").delete().eq("id", m.id);
        }
      }
    }
  }
  } catch (e) {
    await reportError("stripe.webhook", e, { eventType: event.type, eventId: event.id });
    // The dedup marker was inserted BEFORE the handler ran; a failed handler
    // must release it so Stripe's retry re-processes instead of being skipped
    // as a duplicate (which would drop the event permanently). (billing audit #1)
    await clearStripeEvent(event.id);
    return NextResponse.json({ error: "webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
