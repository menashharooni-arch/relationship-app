import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ProfileForm from "@/components/ProfileForm";
import Link from "next/link";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/onboarding");

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-slate-400 uppercase mb-1">Kontact</p>
            <h1 className="text-2xl font-bold text-slate-900">Edit Card</h1>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            ← Dashboard
          </Link>
        </div>
        <ProfileForm profile={profile} />
      </div>
    </main>
  );
}
