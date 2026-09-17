import { NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isPaidPlan, sanitizeCustomizationForPlan } from "@/lib/plan";
import { PLAN_CHOSEN_KEY, sendWelcomeWhenCardLive } from "@/lib/welcome-email";
import { revalidateCardPage, revalidateUserCards } from "@/lib/card-page-data";
import { PRO_ENDED_PENDING_KEY } from "@/lib/billing-state";
import { referralGiftPending, startReferralGift } from "@/lib/referral-server";

// ── "I'll stay on Free" — the moment the plan becomes real ───────────────────
//
// Since 2026-09-15 the plan is chosen AFTER the account exists, on /welcome.
// Paid plans settle through Stripe's webhook (or RevenueCat on iOS). This is
// the other half: the free one, which has no payment processor to tell us it
// happened.
//
// Three things have to happen together, which is why they are one endpoint
// rather than three calls from the client:
//
//   1. The design is converted for good. Until now the card row has held the
//      design exactly as built, because the claim had no plan to judge it by
//      (api/drafts/claim). Choosing Free is the point at which the Pro parts
//      genuinely go — otherwise the row keeps Pro values that only the public
//      renderer hides, and the editor would keep showing a design the card
//      does not have.
//   2. The plan is marked settled, which is what releases the welcome email.
//   3. The email is sent — "Your SwiftCard is live" now means it, because the
//      plan behind it is decided.
//
// Deliberately NOT a plan write: Free IS the absence of a paid plan, and
// profiles.plan already reads "free". Writing it again would be the one place
// that could race the Stripe webhook if somebody paid in another tab.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Optional body. `liveCardId` comes from ProEndedPanel: the card this person
  // wants to keep live on Free now that Pro has ended. The /welcome plan step
  // sends no body at all.
  const body = (await req.json().catch(() => null)) as { liveCardId?: unknown; referralMonth?: unknown } | null;
  const liveCardId = typeof body?.liveCardId === "string" ? body.liveCardId : null;

  const admin = getAdminSupabase();

  // "Start my free month of Pro" — a friend's referral gift, chosen on the
  // plan step (it is no longer switched on at signup; see referral-server).
  // Verified server-side: the gift must still be pending for THIS account.
  // Nothing is converted — they are on Pro for the month.
  if (body?.referralMonth === true) {
    if (!(await referralGiftPending(user.id, user.email))) {
      return NextResponse.json({ error: "This free month isn't available on your account." }, { status: 400 });
    }
    await startReferralGift(user.id, user.email);
    const { data: fresh } = await admin.from("profiles").select("customization").eq("id", user.id).maybeSingle();
    const freshCust = (fresh?.customization ?? {}) as Record<string, unknown>;
    await admin.from("profiles").update({ customization: { ...freshCust, [PLAN_CHOSEN_KEY]: "pro_referral" } }).eq("id", user.id);
    await revalidateUserCards(user.id);
    after(() => sendWelcomeWhenCardLive(user.id, user.email));
    return NextResponse.json({ ok: true, converted: 0 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("plan, customization")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  // Already paid (they upgraded in another tab, or an admin granted it) —
  // choosing Free here must never downgrade them. Settle and let the email go.
  const alreadyPaid = isPaidPlan(profile.plan as string | null);

  const cust = (profile.customization ?? {}) as Record<string, unknown>;
  // Pro ENDED (a trial or subscription ran out) as opposed to a brand-new
  // account picking Free. Same conversion, one difference: nothing that is
  // content gets removed, so Swift Links past the Free cap stay stored.
  const proEnded = cust[PRO_ENDED_PENDING_KEY] === true;
  if (!cust[PLAN_CHOSEN_KEY] || proEnded) {
    const next: Record<string, unknown> = { ...cust };
    if (!next[PLAN_CHOSEN_KEY]) next[PLAN_CHOSEN_KEY] = alreadyPaid ? profile.plan : "free";
    delete next[PRO_ENDED_PENDING_KEY];
    await admin.from("profiles").update({ customization: next }).eq("id", user.id);
  }

  // The card that stays live. Validated as theirs — an id that is not one of
  // this account's cards is ignored and the oldest-card rule stands.
  if (liveCardId && !alreadyPaid) {
    const { data: owned } = await admin
      .from("cards")
      .select("id")
      .eq("id", liveCardId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (owned) {
      await admin.from("profiles").update({ free_live_card_id: liveCardId }).eq("id", user.id);
    }
  }

  // Convert every card this account owns down to its Free-safe design. In
  // practice that is the one card they just built; the loop is because the
  // cap is a plan limit, not a guarantee, and a second card must not keep Pro
  // styling that the first one loses.
  let converted = 0;
  if (!alreadyPaid) {
    const { data: cards } = await admin
      .from("cards")
      .select("id, username, template, customization")
      .eq("user_id", user.id);

    for (const card of cards ?? []) {
      const before = (card.customization ?? {}) as Record<string, unknown>;
      const afterCust = sanitizeCustomizationForPlan(before, false, (card.template as string) || "classic-pro", { keepLinks: proEnded });
      // Only write when something actually changed — an untouched Free card
      // must not take a pointless UPDATE and a cache invalidation.
      if (JSON.stringify(afterCust) === JSON.stringify(before)) {
        // Pro ended: which card is live may have just changed even when its
        // design did not, so the public pages still need to hear about it.
        if (proEnded) revalidateCardPage(card.username as string);
        continue;
      }
      const { error } = await admin
        .from("cards")
        .update({ customization: afterCust })
        .eq("id", card.id);
      if (!error) {
        converted++;
        revalidateCardPage(card.username as string);
      }
    }
  }

  // Choosing a plan is what puts a new account's cards live (lib/card-active
  // rule 5) — drop every cached copy so they open now, not after the TTL.
  await revalidateUserCards(user.id);

  // after(): the visitor is waiting on this response to move to their
  // dashboard, and an email provider must never be in that path.
  after(() => sendWelcomeWhenCardLive(user.id, user.email));

  return NextResponse.json({ ok: true, converted });
}
