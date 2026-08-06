import type { ComponentType } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import NewCardWizard, { type OrgManaged } from "./NewCardWizard";
import GuestDraftClaim from "@/components/GuestDraftClaim";
import { hasWalletConfig } from "@/lib/wallet-config";
import { getOfficeSubUserContext } from "@/lib/office-roles";
import { getOfficeBrandForUser } from "@/lib/office-brand";
import { isPaidPlan, PLAN_LIMITS } from "@/lib/plan";
import { cookies } from "next/headers";
import { SRC_COOKIE, COOKIE_MAX_AGE, isSignupSource } from "@/lib/referral";

// NewCardWizard gains a `guest?: boolean` prop (owned by the card-editor agent).
// Forward-declare it here so this wrapper can pass guest mode before/after that
// change lands — the real optional prop satisfies this type.
const Wizard = NewCardWizard as ComponentType<{
  isPro: boolean;
  guest?: boolean;
  isFirstCard?: boolean;
  appUrl?: string;
  walletEnabled?: boolean;
  org?: OrgManaged | null;
  linkedinEnabled?: boolean;
}>;

// Guests may build a full card here WITHOUT an account — no login wall while
// editing. Auth is required only for protected actions (publish / save / share /
// QR / signature / analytics / leads), which the wizard gates via requireAuth.
// When a signed-in user lands here with a pending guest draft, GuestDraftClaim
// converts it into a real card and moves them into the editor.
export default async function NewCardPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; claim?: string; plan?: string; interval?: string; seats?: string; promo?: string; postcheckout?: string; src?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ?src= — the signup nudge's CTA has always appended this
  // (SignupNudgeHost: `/cards/new?src=${source}`), and this page never read it.
  // Only /join and /r/[code] wrote the source cookie, so EVERY signup that
  // started from the in-app popup or the save-contact CTA was attributed
  // "direct" — meaning the admin acquisition chart reported the product's main
  // growth loop as zero.
  //
  // Written here, before anything can redirect away. Validated against
  // SIGNUP_SOURCES, so an arbitrary ?src= can't invent an attribution — and
  // "referral" is refused outright: that source carries a free month and must
  // only ever come from /r/[code] with a resolved referrer behind it.
  if (sp.src && isSignupSource(sp.src) && sp.src !== "referral") {
    try {
      const jar = await cookies();
      // Don't clobber an existing attribution — first touch wins, same as the
      // referral cookie.
      if (!jar.get(SRC_COOKIE)) {
        jar.set(SRC_COOKIE, sp.src, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: true,
        });
      }
    } catch {
      // Cookies are read-only in some render contexts; attribution is
      // best-effort and must never break card creation.
    }
  }

  // Plan-specific entry (?plan=pro|office). PRO is a single-person upgrade of the
  // one card you already have, so a logged-in Pro buyer who already has a card
  // needs no new card — skip straight to payment. OFFICE is different: it's a
  // company/team setup and the buyer's card becomes seat 1, so an Office buyer
  // ALWAYS builds (or freshly sets up) that card first rather than being dropped
  // onto a bare "Review your order" screen — the card creation IS the first step
  // of Office onboarding. Everyone without a card falls through and builds first.
  // Fetched once (when there's a signed-in user at all) and reused below for
  // both the Pro-CTA redirect check and the first-card design-preview unlock.
  const cardCount = user
    ? ((await getAdminSupabase().from("cards").select("*", { count: "exact", head: true }).eq("user_id", user.id)).count ?? 0)
    : 0;

  if (user && sp.plan === "pro" && sp.claim !== "1") {
    if (cardCount > 0) {
      const qs = new URLSearchParams({ plan: "pro", interval: sp.interval === "annual" ? "annual" : "monthly" });
      // Carry the promo through this fast-path too. The wizard already forwards
      // it (/pricing → builder → /checkout), but a logged-in buyer with an
      // existing card skips the builder entirely via THIS redirect — and the
      // rebuilt query string was dropping their code, so the exact user most
      // likely to convert reached checkout at full price.
      if (sp.promo) qs.set("promo", sp.promo);
      redirect(`/checkout?${qs.toString()}`);
    }
  }

  // Two very different intents share this route:
  //  • `?add=1` — a SIGNED-IN user adding another card to THEIR account (linked
  //    from the dashboard). Build straight into the current account.
  //  • anything else — the marketing "Get started / Create your free card" entry.
  //    This is a NEW-account flow: even if a session happens to be in the browser
  //    (e.g. a returning user), the card must NOT silently merge into that
  //    account. The visitor builds as a guest and explicitly chooses an account
  //    (log in, or sign up with a different email) before it's saved.
  //  • plan-specific CTA (?plan=pro|office) clicked by a LOGGED-IN user — they
  //    intend to buy for THIS account, so build the (seat-1) card straight into
  //    it (authed, no guest gate), then continue to payment.
  const authedPlan = !!user && (sp.plan === "pro" || sp.plan === "office") && sp.claim !== "1";
  const authedAdd = (sp.add === "1" && !!user) || authedPlan;

  let isPro = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    isPro = isPaidPlan(profile?.plan);
  }

  // A Free account already AT the card cap must not enter the add-a-card builder
  // at all: the dashboard hides "+ Add card" at the limit, but a stale tab or
  // bookmark still reaches this URL, and without this check they could build an
  // entire card only to have Save reject it and discard their work at /upgrade.
  // Send them there BEFORE they type anything instead.
  //   • plan CTAs (?plan=pro|office) are exempt — they're on their way to pay.
  //   • postcheckout is exempt — a just-paid buyer can land here before the
  //     Stripe webhook flips their plan, and must never be bounced away.
  if (
    user && sp.add === "1" && !authedPlan && !sp.postcheckout &&
    !isPro && cardCount >= PLAN_LIMITS.FREE_CARD_LIMIT
  ) {
    redirect("/upgrade");
  }

  // First-card design preview: an already-authed Free account building its
  // very first card (dashboard "Add Card" on an empty account) gets the same
  // Pro-design-then-choose-plan treatment a guest gets. A plan-specific CTA
  // (?plan=pro|office) already has a fixed target plan, so it's excluded.
  const isFirstCard = !!user && authedAdd && !authedPlan && !isPro && cardCount === 0;

  // Office SUB-USER adding a card to their account: the company half of the
  // card (nickname, company, logo, website, office phone, fax, address) is
  // already decided by their organization, so the wizard shows it as prepared
  // instead of asking for it. Only for the authed "add" path — guests and
  // account owners see the wizard unchanged.
  let org: OrgManaged | null = null;
  if (user && authedAdd) {
    const subCtx = await getOfficeSubUserContext(user.id);
    // `org` exists for EVERY sub-user, even before the admin has set any
    // branding: company-level fields are org territory regardless, and the
    // server discards them from a member's request either way — showing the
    // inputs on an unbranded office silently lost whatever the member typed.
    if (subCtx) {
      const brand = await getOfficeBrandForUser(user.id).catch(() => null);
      org = {
        company: brand?.company ?? null,
        website: brand?.website ?? null,
        logoUrl: brand?.logoUrl ?? null,
        phone: brand?.phone ?? null,
        fax: brand?.fax ?? null,
        address: brand?.address ?? null,
        lockDesign: brand?.lockTemplate ?? false,
        // The locked look, so the sub-user's live preview matches the office
        // template + colors/fonts while they build (not only after saving).
        template: brand?.template ?? null,
        design: brand?.design ?? null,
        customLayout: brand?.customLayout ?? null,
      };
    }
  }

  // The pending draft is claimed ONLY on `claim=1` — the post-auth return from
  // the account gate (GuestGateModal stamps it on the redirect URL), i.e. the
  // visitor just chose an account for THIS draft. GuestDraftClaim additionally
  // verifies the draft carries fresh gate consent before posting it.
  // Deliberately NOT on `add=1`: a signed-in user clicking "Add Card" expects a
  // blank wizard — a leftover guest draft from an earlier visit (possibly built
  // for a different account) must never silently merge in.
  const claimHere = !!user && sp.claim === "1";

  return (
    <>
      {claimHere && <GuestDraftClaim />}
      <Wizard
        isPro={isPro}
        guest={!authedAdd}
        isFirstCard={isFirstCard}
        appUrl={process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me"}
        walletEnabled={hasWalletConfig()}
        org={org}
        linkedinEnabled={!!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)}
      />
    </>
  );
}
