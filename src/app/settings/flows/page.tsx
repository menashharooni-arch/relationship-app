import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import ZapierSettings from "@/components/ZapierSettings";
import IntegrationsSettings from "@/components/IntegrationsSettings";
import ManageCards from "@/components/ManageCards";
import GeneralSettings from "@/components/GeneralSettings";
import BillingManager from "@/components/BillingManager";
import ManageAccount from "@/components/ManageAccount";
import ReferAFriend from "@/components/ReferAFriend";
import { getReferralProgress } from "@/lib/referral-server";
import CrmEventSettings from "@/components/CrmEventSettings";
import EnablePushButton from "@/components/EnablePushButton";
import HelpWidget from "@/components/HelpWidget";
import TakeTourButton from "@/components/TakeTourButton";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";
import DashboardLink from "@/components/DashboardLink";
import GrowLinkButton from "@/components/GrowLinkButton";
import { ensureUserCards } from "@/lib/ensure-cards";
import MobileNav from "@/components/MobileNav";
import SettingsShell, { type SettingsSection } from "@/components/SettingsShell";
import { resolveOfficeContext, roleHasCapability, canViewOfficeAdmin } from "@/lib/office-roles";
import { Suspense } from "react";
import Link from "next/link";

// Rail icons — small, uniform, and deliberately plain so the labels do the work.
const I = {
  general: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" /></svg>),
  cards: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>),
  integrations: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.007-1.875 2.25-1.875s2.25.84 2.25 1.875c0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" /></svg>),
  billing: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>),
  grow: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>),
  help: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>),
  account: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>),
};

export default async function FlowSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { billing } = await searchParams;
  const openBilling = billing === "1";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Preserve the destination (e.g. the "Manage billing" link in a receipt email)
  // so the visitor lands back on this page — with billing open — after signing in.
  if (!user) redirect(`/login?next=${encodeURIComponent(`/settings/flows${openBilling ? "?billing=1" : ""}`)}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("flow_settings, plan, zapier_webhook_url, name, username, customization")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding");
  if ((profile.customization as { _deleted?: boolean } | null)?._deleted) redirect("/account-deleted");

  const isPro = profile.plan === "pro" || profile.plan === "enterprise";

  await ensureUserCards(user.id);

  const admin = getAdminSupabase();
  const [{ data: integrations }, { data: cards }] = await Promise.all([
    admin.from("integrations").select("provider, sync_error").eq("user_id", user.id),
    admin
      .from("cards")
      .select("id, username, name, title, label")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  // An office SUB-USER is an active member who is NOT the owner — an employee on
  // someone else's team. Their account is company-managed, so the settings that
  // only make sense for an account holder are hidden from them: their cards are
  // managed from /office/admin, they have no subscription of their own to bill or
  // cancel, and the referral/growth programme isn't aimed at them.
  //
  // Billing is gated on the CAPABILITY rather than plain membership, so a
  // delegated billing_admin (a real role in this office model) keeps the section
  // they exist to use.
  const officeCtx = await resolveOfficeContext(user.id);
  const isOfficeSubUser = !!officeCtx && !officeCtx.isOwner;
  const canSeeBilling = !isOfficeSubUser || roleHasCapability(officeCtx.role, "manage_billing");

  const isOfficeAdmin = await canViewOfficeAdmin(user.id, profile.plan);

  const referral = await getReferralProgress(user.id);
  const googleIntegration = integrations?.find((i) => i.provider === "google");
  const hubspotIntegration = integrations?.find((i) => i.provider === "hubspot");
  const linkedinIntegration = integrations?.find((i) => i.provider === "linkedin");
  const googleConnected = !!googleIntegration;
  const hubspotConnected = !!hubspotIntegration;
  const linkedinConnected = !!linkedinIntegration;
  const googleSyncError = (googleIntegration as { sync_error?: string | null } | undefined)?.sync_error ?? null;
  const hubspotSyncError = (hubspotIntegration as { sync_error?: string | null } | undefined)?.sync_error ?? null;
  const linkedinSyncError = (linkedinIntegration as { sync_error?: string | null } | undefined)?.sync_error ?? null;

  // One section per area of the product, rendered one at a time by SettingsShell.
  // Everything that existed before still exists — it's grouped instead of stacked.
  // `false &&` entries are dropped below, so per-role visibility is decided here
  // on the server rather than hidden with CSS.
  const sections: SettingsSection[] = [
    {
      id: "general",
      label: "General",
      desc: "Your account details and notifications.",
      icon: I.general,
      content: (
        <div data-tour="settings-general" className="space-y-3">
          <GeneralSettings
            email={user.email ?? ""}
            cardCount={cards?.length ?? 0}
            plan={profile.plan ?? "free"}
            isPro={isPro}
          />
          {/* Push notifications toggle — the wizard offers opt-in once at card
              creation; this is the permanent on/off switch for this device. */}
          <EnablePushButton label="Turn on push notifications" allowDisable />
        </div>
      ),
    },
    ...(isOfficeSubUser ? [] : [{
      id: "cards",
      label: "Cards",
      desc: "Rename, open, or remove a card.",
      icon: I.cards,
      content: (
        <div data-tour="settings-cards">
          <ManageCards cards={cards ?? []} />
        </div>
      ),
    } as SettingsSection]),
    {
      id: "integrations",
      label: "Integrations",
      desc: "Send new contacts straight into the tools you already use.",
      icon: I.integrations,
      content: (
        <div data-tour="settings-integrations" className="space-y-3">
          <ZapierSettings initialUrl={profile.zapier_webhook_url ?? null} isPro={isPro} />
          <Suspense>
            <IntegrationsSettings
              googleConnected={googleConnected}
              hubspotConnected={hubspotConnected}
              googleSyncError={googleSyncError}
              hubspotSyncError={hubspotSyncError}
              isPro={isPro}
              hubspotEnabled={!!(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET)}
              linkedinEnabled={!!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)}
              linkedinConnected={linkedinConnected}
              linkedinSyncError={linkedinSyncError}
            />
          </Suspense>
          <CrmEventSettings
            initialNotifications={!!(profile.customization as { crm?: { notifications?: boolean } } | null)?.crm?.notifications}
            initialViews={!!(profile.customization as { crm?: { views?: boolean } } | null)?.crm?.views}
            zapierConnected={!!profile.zapier_webhook_url}
            isPro={isPro}
          />
        </div>
      ),
    },
    ...(canSeeBilling ? [{
      id: "billing",
      label: "Billing",
      desc: "Your plan, seats, invoices and payment method.",
      icon: I.billing,
      content: (
        <div id="billing" data-tour="settings-billing" className="scroll-mt-24">
          <BillingManager />
        </div>
      ),
    } as SettingsSection] : []),
    ...(isOfficeSubUser ? [] : [{
      id: "grow",
      label: "Refer & grow",
      desc: "Invite a friend and earn free months.",
      icon: I.grow,
      content: (
        <div data-tour="settings-refer">
          <ReferAFriend progress={referral} />
          <Link
            href="/grow"
            className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 rounded-full py-2.5 transition-colors"
          >
            More ways to help us grow
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </Link>
        </div>
      ),
    } as SettingsSection]),
    {
      id: "help",
      label: "Help",
      desc: "Ask a question or replay the guided tour.",
      icon: I.help,
      content: (
        <div data-tour="settings-help" className="space-y-3">
          <HelpWidget />
          <TakeTourButton />
        </div>
      ),
    },
    ...(isOfficeSubUser ? [] : [{
      id: "account",
      label: "Account",
      desc: "Account-level actions. Deleting is permanent.",
      icon: I.account,
      quiet: true,
      content: (
        <div data-tour="settings-account">
          <ManageAccount isPro={isPro} plan={profile.plan ?? "free"} />
          <p className="mt-6">
            <a href="/privacy" className="text-gray-600 hover:text-gray-400 text-[11px] underline">Privacy Policy</a>
          </p>
        </div>
      ),
    } as SettingsSection]),
  ];

  return (
    <main className="sc-app min-h-screen bg-gray-950 px-5 py-10 pb-24 md:pb-10">
      <MobileNav />

      {/* Top accent stripe */}
      <div className="fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />

      {/* Sticky nav */}
      <nav className="sc-app fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <DashboardLink className="flex items-center gap-2">
              <SwiftCardIcon size={28} />
              <span className="font-bold text-white text-sm tracking-tight hidden sm:block">SwiftCard</span>
            </DashboardLink>
          </div>

          <div className="hidden md:flex items-center gap-0.5">
            <DashboardLink className="text-sm px-3 py-1.5 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-gray-800/60">
              Dashboard
            </DashboardLink>
            {[
              { href: "/contacts",  label: "Contacts" },
              { href: "/share", label: "Share" },
              { href: "/settings/flows", label: "Settings", active: true },
            ].map(({ href, label, active }) => (
              <Link key={href} href={href}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${active ? "text-white font-medium bg-gray-800" : "text-gray-400 hover:text-white hover:bg-gray-800/60"}`}>
                {label}
              </Link>
            ))}
            {isOfficeAdmin && (
              <Link href="/office/admin" className="text-sm text-purple-400 hover:text-purple-300 hover:bg-gray-800/60 px-3 py-1.5 rounded-lg transition-colors font-medium">
                Admin
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <GrowLinkButton />
            <DashboardLink className="text-sm text-gray-500 hover:text-white transition-colors">
              ← Dashboard
            </DashboardLink>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto pt-20">
        <div className="mb-8">
          <p className="text-[11px] font-bold tracking-[0.25em] text-blue-500 uppercase mb-1">SwiftCard</p>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">{user.email}</p>
        </div>

        <SettingsShell initialSection={openBilling ? "billing" : undefined} sections={sections} />
      </div>
    </main>
  );
}
