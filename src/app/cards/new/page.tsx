import type { ComponentType } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import NewCardWizard, { type OrgManaged } from "./NewCardWizard";
import GuestDraftClaim from "@/components/GuestDraftClaim";
import { hasWalletConfig } from "@/lib/wallet-config";
import { getOfficeSubUserContext } from "@/lib/office-roles";
import { getOfficeBrandForUser } from "@/lib/office-brand";

// NewCardWizard gains a `guest?: boolean` prop (owned by the card-editor agent).
// Forward-declare it here so this wrapper can pass guest mode before/after that
// change lands — the real optional prop satisfies this type.
const Wizard = NewCardWizard as ComponentType<{
  isPro: boolean;
  guest?: boolean;
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
  searchParams: Promise<{ add?: string; claim?: string; plan?: string; interval?: string; seats?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Plan-specific entry (?plan=pro|office). PRO is a single-person upgrade of the
  // one card you already have, so a logged-in Pro buyer who already has a card
  // needs no new card — skip straight to payment. OFFICE is different: it's a
  // company/team setup and the buyer's card becomes seat 1, so an Office buyer
  // ALWAYS builds (or freshly sets up) that card first rather than being dropped
  // onto a bare "Review your order" screen — the card creation IS the first step
  // of Office onboarding. Everyone without a card falls through and builds first.
  if (user && sp.plan === "pro" && sp.claim !== "1") {
    const { count } = await getAdminSupabase()
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) > 0) {
      const qs = new URLSearchParams({ plan: "pro", interval: sp.interval === "annual" ? "annual" : "monthly" });
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
    isPro = profile?.plan === "pro" || profile?.plan === "enterprise";
  }

  // Office SUB-USER adding a card to their account: the company half of the
  // card (nickname, company, logo, website, office phone, fax, address) is
  // already decided by their organization, so the wizard shows it as prepared
  // instead of asking for it. Only for the authed "add" path — guests and
  // account owners see the wizard unchanged.
  let org: OrgManaged | null = null;
  if (user && authedAdd) {
    const subCtx = await getOfficeSubUserContext(user.id);
    const brand = subCtx ? await getOfficeBrandForUser(user.id).catch(() => null) : null;
    if (subCtx && brand) {
      org = {
        company: brand.company,
        website: brand.website,
        logoUrl: brand.logoUrl,
        phone: brand.phone,
        fax: brand.fax,
        address: brand.address,
        lockDesign: brand.lockTemplate,
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
        appUrl={process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me"}
        walletEnabled={hasWalletConfig()}
        org={org}
        linkedinEnabled={!!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)}
      />
    </>
  );
}
