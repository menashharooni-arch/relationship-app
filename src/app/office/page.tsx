import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import OfficeDashboard from "@/components/OfficeDashboard";
import CreateOfficeForm from "@/components/CreateOfficeForm";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

type Member = {
  id: string;
  invite_email: string;
  invite_token: string;
  status: string;
  role: string;
  joined_at: string | null;
  user_id: string | null;
};

export default async function OfficePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, name")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");
  if (profile.plan !== "enterprise") redirect("/pricing");

  const { data: office } = await supabase
    .from("offices")
    .select("*, office_members(*)")
    .eq("owner_id", user.id)
    .single();

  return (
    <main className="min-h-screen bg-gray-950 px-5 py-10">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-gray-500 uppercase mb-1">Kontact</p>
            <h1 className="text-2xl font-bold text-white">Team Dashboard</h1>
          </div>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← My card
          </Link>
        </div>

        {!office ? (
          <CreateOfficeForm />
        ) : (
          <OfficeDashboard
            office={office}
            members={(office.office_members ?? []) as Member[]}
            appUrl={APP_URL}
          />
        )}
      </div>
    </main>
  );
}
