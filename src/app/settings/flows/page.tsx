import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import FlowSettingsForm from "@/components/FlowSettingsForm";
import ZapierSettings from "@/components/ZapierSettings";
import IntegrationsSettings from "@/components/IntegrationsSettings";
import EmailPreferencesForm from "@/components/EmailPreferencesForm";
import MobileNav from "@/components/MobileNav";
import { Suspense } from "react";
import Link from "next/link";

export default async function FlowSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("flow_settings, plan, zapier_webhook_url")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding");

  const defaults = {
    day1: { enabled: true, time: "13:00" },
    day15: { enabled: true, time: "13:00" },
    day30: { enabled: true, time: "13:00" },
  };

  const settings = (profile.flow_settings as typeof defaults) ?? defaults;
  const isPro = profile.plan === "pro" || profile.plan === "enterprise";

  const admin = getAdminSupabase();
  const { data: integrations } = await admin
    .from("integrations")
    .select("provider")
    .eq("user_id", user.id);

  const googleConnected = integrations?.some((i) => i.provider === "google") ?? false;
  const hubspotConnected = integrations?.some((i) => i.provider === "hubspot") ?? false;

  // Email preferences
  const { data: emailPrefs } = await admin
    .from("email_preferences")
    .select("marketing_emails, receipt_emails")
    .eq("user_id", user.id)
    .single();

  return (
    <main className="min-h-screen bg-cream px-5 py-10 pb-24 md:pb-10">
      <MobileNav />
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-brand uppercase mb-1">SwiftCard</p>
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-500 text-sm mt-1">Follow-up flows & integrations</p>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            ← Dashboard
          </Link>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Follow-up Emails</p>
            <FlowSettingsForm initialSettings={settings} isPro={isPro} />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Email Preferences</p>
            <EmailPreferencesForm
              initialMarketing={emailPrefs?.marketing_emails ?? true}
              initialReceipts={emailPrefs?.receipt_emails ?? true}
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Integrations</p>
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
