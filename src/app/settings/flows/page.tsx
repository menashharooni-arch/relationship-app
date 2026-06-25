import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import ZapierSettings from "@/components/ZapierSettings";
import IntegrationsSettings from "@/components/IntegrationsSettings";
import ManageCards from "@/components/ManageCards";
import ManageBillingButton from "@/components/ManageBillingButton";
import HelpWidget from "@/components/HelpWidget";
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
    .select("flow_settings, plan, zapier_webhook_url, name, username")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding");

  const isPro = profile.plan === "pro" || profile.plan === "enterprise";

  await ensureUserCards(user.id);

  const admin = getAdminSupabase();
  const [{ data: integrations }, { data: cards }] = await Promise.all([
    admin.from("integrations").select("provider").eq("user_id", user.id),
    admin
      .from("cards")
      .select("id, username, name, title, label")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  const googleConnected = integrations?.some((i) => i.provider === "google") ?? false;
  const hubspotConnected = integrations?.some((i) => i.provider === "hubspot") ?? false;

  return (
    <main className="min-h-screen bg-gray-950 px-5 py-10 pb-24 md:pb-10">
      <MobileNav />

      {/* Top accent stripe */}
      <div className="fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />

      {/* Sticky nav */}
      <nav className="fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-bold text-white text-sm tracking-tight hidden sm:block">SwiftCard</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-0.5">
            {[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/contacts",  label: "Contacts" },
              { href: "/settings/flows", label: "Settings", active: true },
            ].map(({ href, label, active }) => (
              <Link key={href} href={href}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${active ? "text-white font-medium bg-gray-800" : "text-gray-400 hover:text-white hover:bg-gray-800/60"}`}>
                {label}
              </Link>
            ))}
          </div>

          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-white transition-colors">
            ← Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-sm mx-auto pt-20">
        <div className="mb-8">
          <p className="text-[11px] font-bold tracking-[0.25em] text-blue-500 uppercase mb-1">SwiftCard</p>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>

        <div className="space-y-8">
          {/* General settings */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">General</p>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              {/* Account info */}
              <div>
                <p className="text-gray-500 text-[11px] uppercase tracking-wide mb-2">Account</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500 text-xs shrink-0">Email</span>
                    <span className="text-white text-xs font-medium truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500 text-xs shrink-0">Cards</span>
                    <span className="text-white text-xs font-medium truncate">{(cards?.length ?? 0)} card{(cards?.length ?? 0) === 1 ? "" : "s"}</span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-800" />

              {/* Subscription & payment */}
              <div>
                <p className="text-gray-500 text-[11px] uppercase tracking-wide mb-2">Subscription</p>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-gray-500 text-xs">Current plan</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${profile.plan === "enterprise" ? "bg-purple-600 text-white" : isPro ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
                    {profile.plan === "enterprise" ? "Office" : isPro ? "Pro" : "Free"}
                  </span>
                </div>
                {isPro ? (
                  <ManageBillingButton />
                ) : (
                  <Link href="/pricing" className="block text-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-full py-2.5 transition-colors">
                    Upgrade to Pro →
                  </Link>
                )}
                <p className="text-gray-600 text-[11px] mt-2 leading-relaxed">
                  {isPro
                    ? "Update your payment method, view invoices, or cancel anytime in the billing portal."
                    : "Pro unlocks unlimited cards, analytics, custom card design, and removes SwiftCard branding."}
                </p>
              </div>
            </div>
          </div>

          {/* Help */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Help</p>
            <HelpWidget />
          </div>

          {/* Your cards */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your cards</p>
            <ManageCards cards={cards ?? []} />
          </div>

          {/* Integrations */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Integrations</p>
            <div className="space-y-3">
              <ZapierSettings initialUrl={profile.zapier_webhook_url ?? null} isPro={isPro} />
              <Suspense>
                <IntegrationsSettings
                  googleConnected={googleConnected}
                  hubspotConnected={hubspotConnected}
                  isPro={isPro}
                />
              </Suspense>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
