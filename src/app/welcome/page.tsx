import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isPaidPlan, describeFreeDesignChanges, proLinkFeaturesInUse, PLAN_LIMITS } from "@/lib/plan";
import type { PlanIntent } from "@/lib/plan-intent";
import type { CardLink } from "@/components/card-templates/types";
import WelcomePlan from "@/components/WelcomePlan";
import { isProTrialEligible } from "@/lib/trial-eligibility";
import { trialHistoryFor } from "@/lib/trial-ledger";
import { findPendingInviteForEmail } from "@/lib/pending-invite";
import { referralGiftPending } from "@/lib/referral-server";

// Post-signup onboarding step. A brand-new account lands here right after its
// first card is claimed (GuestDraftClaim → /welcome?card=slug): turn on
// notifications, then choose a plan. Already-paid or signed-out users are sent
// on so this only ever shows once, at the right moment.
export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ card?: string; designConverted?: string; plan?: string; interval?: string; seats?: string; promo?: string; step?: string; for?: string; canceled?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/welcome");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  // A team member never chooses a plan — their seat IS the plan. Someone with
  // an open invite for this address who built a card first (the app's "Get
  // Started") goes to Join, not to "choose your plan". (2026-09-16 audit.)
  if (!isPaidPlan(profile?.plan)) {
    const invite = await findPendingInviteForEmail(user.email);
    if (invite) redirect(`/join/${encodeURIComponent(invite.token)}`);
  }

  // Back from paying: the "card is live" setup step (notifications, the app),
  // then on to their plan's home. Anyone else already paid skips this page.
  const setupFor = sp.step === "setup" && isPaidPlan(profile?.plan) ? (sp.for === "office" ? "office" : "pro") : null;
  // tour=1 only (not welcome=1): welcome=1 re-opened the "Your account is
  // ready, get the app" popup for accounts that had already seen it.
  if (isPaidPlan(profile?.plan) && !setupFor) redirect("/dashboard?tour=1");

  // WHAT FREE WOULD COST THEM, worked out server-side so the choice can be
  // honest at the moment it is made.
  //
  // The card was stored exactly as designed (api/drafts/claim no longer guesses
  // a plan), so if it uses Pro-only design this is where they find out — before
  // choosing, not after, and with the option to keep it. Named by the same two
  // checkers the wizard and the editor use, so all three agree about what
  // counts as Pro.
  // The ADMIN client, scoped by the authenticated id — the same shape
  // dashboard/page.tsx uses (adminDb + .eq("user_id", authedUserId)) and for the
  // same reason: `cards` has no owner-read policy, so a user-scoped SELECT of
  // your own card comes back EMPTY rather than erroring. Read through the
  // session client and this list is always [], the panel below can never open,
  // and a card built with Pro design is flattened in silence — which is the one
  // thing this whole step exists to prevent. Caught end to end; no source-level
  // test can see it, because the code looks right.
  const { data: card } = await getAdminSupabase()
    .from("cards")
    .select("template, customization, username")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const cust = (card?.customization ?? {}) as Record<string, unknown>;
  const template = (card?.template as string) || "classic-pro";
  const proDesignChanges = card
    ? [
        ...describeFreeDesignChanges(cust, template),
        ...proLinkFeaturesInUse(cust, (cust.links as CardLink[] | undefined) ?? []).map((n) => `${n} is not included`),
      ]
    : [];

  const cardSlug = typeof sp.card === "string" && sp.card ? sp.card : ((card?.username as string | undefined) ?? null);
  // Same eligibility check /checkout uses, so /welcome never promises a trial
  // checkout won't grant.
  let trialEligible = true;
  try {
    const { data: billing } = await getAdminSupabase().from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
    trialEligible = await isProTrialEligible((billing?.stripe_customer_id as string | null) ?? null, undefined, await trialHistoryFor(user.id, user.email));
  } catch { /* fail open, like /checkout */ }
  // A friend's free month, offered here rather than switched on at signup.
  const referralGift = await referralGiftPending(user.id, user.email).catch(() => false);
  // A paid plan picked on /pricing before signing up (carried by the claim).
  const presetIntent: PlanIntent | null =
    sp.plan === "pro" || sp.plan === "office"
      ? {
          plan: sp.plan,
          annual: sp.interval === "annual",
          ...(sp.plan === "office" ? { seats: Math.max(PLAN_LIMITS.OFFICE_MIN_SEATS, Math.floor(Number(sp.seats)) || PLAN_LIMITS.OFFICE_MIN_SEATS) } : {}),
          ...(typeof sp.promo === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(sp.promo) ? { promo: sp.promo } : {}),
        }
      : null;
  return (
    <WelcomePlan
      cardSlug={cardSlug}
      presetIntent={presetIntent}
      setupFor={setupFor}
      canceled={sp.canceled === "1"}
      trialEligible={trialEligible}
      referralGift={referralGift}
      designConverted={sp.designConverted === "1"}
      proDesignChanges={proDesignChanges}
    />
  );
}
