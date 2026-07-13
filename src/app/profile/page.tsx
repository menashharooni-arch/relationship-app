import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import ProfileForm from "@/components/ProfileForm";
import FlowSettingsForm from "@/components/FlowSettingsForm";
import EmailPreferencesForm from "@/components/EmailPreferencesForm";
import MobileNav from "@/components/MobileNav";
import CopyButton from "@/components/CopyButton";
import DashboardLink from "@/components/DashboardLink";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/onboarding");

  const admin = getAdminSupabase();
  const { data: emailPrefs } = await admin
    .from("email_preferences")
    .select("marketing_emails, receipt_emails")
    .eq("user_id", user.id)
    .single();

  const defaults = {
    day1: { enabled: true, time: "13:00" },
    day15: { enabled: true, time: "13:00" },
    day30: { enabled: true, time: "13:00" },
  };
  const settings = (profile.flow_settings as typeof defaults) ?? defaults;

  return (
    <main className="min-h-screen bg-cream px-5 py-10 pb-24 md:pb-10">
      <MobileNav />
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-slate-400 uppercase mb-1">SwiftCard</p>
            <h1 className="text-2xl font-bold text-slate-900">Edit Card</h1>
          </div>
          <DashboardLink className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            ← Dashboard
          </DashboardLink>
        </div>
        {/* Live card link */}
        <div className="mb-6 flex items-center gap-2 bg-white border border-warm-card-border rounded-2xl px-4 py-3 shadow-sm">
          <a
            href={`${APP_URL}/card/${profile.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0 text-blue-600 text-xs font-mono truncate hover:underline"
          >
            {`${APP_URL}/card/${profile.username}`.replace("https://", "")}
          </a>
          <CopyButton text={`${APP_URL}/card/${profile.username}`} />
          <a
            href={`${APP_URL}/card/${profile.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors shrink-0"
          >
            Preview
          </a>
        </div>

        <ProfileForm profile={profile} />

        <div className="mt-8 pt-8 border-t border-gray-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Follow-up Automation</h2>
          <FlowSettingsForm initialSettings={settings} />
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Email Preferences</h2>
          <EmailPreferencesForm
            initialMarketing={emailPrefs?.marketing_emails ?? true}
            initialReceipts={emailPrefs?.receipt_emails ?? true}
          />
        </div>
      </div>
    </main>
  );
}
