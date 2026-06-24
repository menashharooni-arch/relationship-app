import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ProfileForm from "@/components/ProfileForm";
import MobileNav from "@/components/MobileNav";
import CopyButton from "@/components/CopyButton";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/onboarding");

  return (
    <main className="min-h-screen bg-cream px-5 py-10 pb-24 md:pb-10">
      <MobileNav />
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-slate-400 uppercase mb-1">SwiftCard</p>
            <h1 className="text-2xl font-bold text-slate-900">Edit Card</h1>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            ← Dashboard
          </Link>
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
      </div>
    </main>
  );
}
