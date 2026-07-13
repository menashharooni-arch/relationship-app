import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import ZapierSettings from "@/components/ZapierSettings";
import IntegrationsSettings from "@/components/IntegrationsSettings";
import ManageCards from "@/components/ManageCards";
import GeneralSettings from "@/components/GeneralSettings";
import ManageAccount from "@/components/ManageAccount";
import ReferAFriend from "@/components/ReferAFriend";
import { getReferralProgress } from "@/lib/referral-server";
import CrmEventSettings from "@/components/CrmEventSettings";
import EnablePushButton from "@/components/EnablePushButton";
import HelpWidget from "@/components/HelpWidget";
import TakeTourButton from "@/components/TakeTourButton";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";
import GrowLinkButton from "@/components/GrowLinkButton";
import { ensureUserCards } from "@/lib/ensure-cards";
import MobileNav from "@/components/MobileNav";
import { Suspense } from "react";
import Link from "next/link";

export default async function FlowSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

  return (
    <main className="sc-app min-h-screen bg-gray-950 px-5 py-10 pb-24 md:pb-10">
      <MobileNav />

      {/* Top accent stripe */}
      <div className="fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />

      {/* Sticky nav */}
      <nav className="sc-app fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2">
              <SwiftCardIcon size={28} />
              <span className="font-bold text-white text-sm tracking-tight hidden sm:block">SwiftCard</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-0.5">
            {[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/contacts",  label: "Contacts" },
              { href: "/share", label: "Share" },
              { href: "/settings/flows", label: "Settings", active: true },
            ].map(({ href, label, active }) => (
              <Link key={href} href={href}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${active ? "text-white font-medium bg-gray-800" : "text-gray-400 hover:text-white hover:bg-gray-800/60"}`}>
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <GrowLinkButton />
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-white transition-colors">
              ← Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-sm mx-auto pt-20">
        <div className="mb-8">
          <p className="text-[11px] font-bold tracking-[0.25em] text-blue-500 uppercase mb-1">SwiftCard</p>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>

        <div className="space-y-8">
          {/* Your cards */}
          <div data-tour="settings-cards">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your cards</p>
            <ManageCards cards={cards ?? []} />
          </div>

          {/* Help — the AI assistant, plus replay the guided tour */}
          <div data-tour="settings-help">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Need help</p>
            <div className="space-y-3">
              <HelpWidget />
              <TakeTourButton />
            </div>
          </div>

          {/* Refer a friend — its own section, between Need help and Integrations */}
          <div data-tour="settings-refer">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Refer a friend</p>
            <ReferAFriend progress={referral} />
            <Link
              href="/grow"
              className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 rounded-full py-2.5 transition-colors"
            >
              More ways to help us grow
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </Link>
          </div>

          {/* Integrations */}
          <div data-tour="settings-integrations">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Integrations</p>
            <div className="space-y-3">
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
          </div>

          {/* General */}
          <div data-tour="settings-general">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">General</p>
            <GeneralSettings
              email={user.email ?? ""}
              cardCount={cards?.length ?? 0}
              plan={profile.plan ?? "free"}
              isPro={isPro}
            />
            {/* Push notifications toggle — the wizard offers opt-in once at card
                creation; this is the permanent on/off switch for this device. */}
            <div className="mt-3">
              <EnablePushButton label="Turn on push notifications" allowDisable />
            </div>
          </div>

          {/* Manage account */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Manage account</p>
            <ManageAccount isPro={isPro} />
            <p className="text-center mt-4">
              <a href="/privacy" className="text-gray-600 hover:text-gray-400 text-[11px] underline">Privacy Policy</a>
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}
