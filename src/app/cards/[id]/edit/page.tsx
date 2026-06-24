import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import CardEditForm from "./CardEditForm";
import Link from "next/link";

export default async function CardEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getAdminSupabase();
  const { data: card } = await admin
    .from("cards")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!card) notFound();

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

  return (
    <main className="min-h-screen bg-gray-950 px-5 py-10">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Dashboard
          </Link>
          <a
            href={`${APP_URL}/card/${card.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            View live →
          </a>
        </div>

        <div className="mb-6">
          <p className="text-[11px] font-bold tracking-[0.25em] text-gray-500 uppercase mb-1">SwiftCard</p>
          <h1 className="text-2xl font-bold text-white">Edit card</h1>
          <p className="text-gray-500 text-sm mt-1">/{card.username}</p>
        </div>

        <CardEditForm card={card} />
      </div>
    </main>
  );
}
