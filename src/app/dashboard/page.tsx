import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";
import CopyButton from "@/components/CopyButton";
import LeadCard from "@/components/LeadCard";
import QRCard from "@/components/QRCard";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");

  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, email, phone, notes, created_at")
    .eq("card_owner", profile.username)
    .order("created_at", { ascending: false });

  const cardUrl = `${APP_URL}/card/${profile.username}`;
  const allLeads = leads ?? [];

  return (
    <main className="min-h-screen bg-gray-950 px-5 py-10">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-gray-500 uppercase mb-1">Evercard</p>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/profile" className="text-sm text-gray-400 hover:text-white transition-colors">
              Edit card
            </Link>
            <SignOutButton />
          </div>
        </div>

        {/* Card URL + QR */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Your card link</p>
          <div className="flex items-center gap-3 bg-gray-950 rounded-xl px-4 py-3 mb-4">
            <span className="text-blue-400 text-sm truncate flex-1">{cardUrl}</span>
            <CopyButton text={cardUrl} />
          </div>
          <a
            href={cardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Preview your card →
          </a>
        </div>

        {/* QR code */}
        <div className="mb-6">
          <QRCard url={cardUrl} />
        </div>

        {/* Leads */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">Leads</h2>
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
              {allLeads.length}
            </span>
          </div>
          {allLeads.length > 0 && (
            <a
              href={`/api/leads/export?username=${profile.username}`}
              className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg"
            >
              Export CSV
            </a>
          )}
        </div>

        {allLeads.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-4xl mb-3">📭</p>
            <p>No leads yet.</p>
            <p className="text-sm mt-1">Share your card link or QR code to start collecting.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
