import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import FlowSettingsForm from "@/components/FlowSettingsForm";
import Link from "next/link";

export default async function FlowSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("flow_settings, plan")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding");

  const defaults = {
    day1: { enabled: true, time: "13:00" },
    day15: { enabled: true, time: "13:00" },
    day30: { enabled: true, time: "13:00" },
  };

  const settings = (profile.flow_settings as typeof defaults) ?? defaults;

  return (
    <main className="min-h-screen bg-gray-950 px-5 py-10">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-gray-500 uppercase mb-1">Kontact</p>
            <h1 className="text-2xl font-bold text-white">Follow-up Flows</h1>
            <p className="text-gray-500 text-sm mt-1">Control when automated emails go out.</p>
          </div>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Dashboard
          </Link>
        </div>

        <FlowSettingsForm initialSettings={settings} isPro={profile.plan === "pro"} />
      </div>
    </main>
  );
}
