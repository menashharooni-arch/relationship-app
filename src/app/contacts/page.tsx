import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import ContactsClient from "@/components/ContactsClient";
import MobileNav from "@/components/MobileNav";
import { ensureUserCards } from "@/lib/ensure-cards";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";
import Link from "next/link";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ card?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { card: selectedCardParam } = await searchParams;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, plan, customization")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding");
  if ((profile.customization as { _deleted?: boolean } | null)?._deleted) redirect("/account-deleted");

  await ensureUserCards(user.id);

  const admin = getAdminSupabase();
  const { data: cards } = await admin
    .from("cards")
    .select("id, username, name, label")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const cardList = cards ?? [];
  const allUsernames = cardList.map((c) => c.username);

  const { data: leads } = await admin
    .from("leads")
    .select("id, name, email, phone, company, company_description, location, notes, status, tags, follow_up_date, source, visitor_id, card_owner, where_met, convo_details, message, created_at")
    .in("card_owner", allUsernames)
    .order("name", { ascending: true });

  // Carry the selected card back to the dashboard so it doesn't flip to the first card.
  const dashCard = selectedCardParam ?? cardList[0]?.username;
  const dashHref = dashCard ? `/dashboard?card=${dashCard}` : "/dashboard";

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col pb-16 md:pb-0">
      <MobileNav />
      {/* Top accent stripe */}
      <div className="fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />

      {/* Sticky nav */}
      <nav className="fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <Link href={dashHref} className="flex items-center gap-2">
              <SwiftCardIcon size={28} />
              <span className="font-bold text-white text-base tracking-tight">SwiftCard</span>
            </Link>
          </div>

          <div className="hidden sm:flex items-center gap-1">
            <Link href={dashHref} className="text-sm text-gray-400 hover:text-white hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-colors">
              Dashboard
            </Link>
            <Link href="/contacts" className="text-sm text-white font-medium px-3 py-1.5 rounded-lg bg-gray-800">
              Contacts
            </Link>
            <Link href="/settings/flows" className="text-sm text-gray-400 hover:text-white hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-colors">
              Settings
            </Link>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link href={dashHref} className="text-sm text-gray-400 hover:text-white transition-colors">
              ← Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="pt-[57px] border-b border-gray-800 px-6 py-5 bg-gray-950">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Contacts</h1>
            <p className="text-gray-500 text-sm mt-0.5">Everyone who shared their info with you, with full activity history.</p>
          </div>
          {(leads?.length ?? 0) > 0 && (
            <a
              href={`/api/leads/export`}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M8 1a.75.75 0 01.75.75v6.19l1.22-1.22a.75.75 0 111.06 1.06l-2.5 2.5a.75.75 0 01-1.06 0l-2.5-2.5a.75.75 0 111.06-1.06l1.22 1.22V1.75A.75.75 0 018 1zM1.5 10.5a.75.75 0 01.75.75v1.5c0 .138.112.25.25.25h11a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 0113.5 14.5h-11A1.75 1.75 0 01.75 12.75v-1.5a.75.75 0 01.75-.75z" clipRule="evenodd"/>
              </svg>
              Export CSV
            </a>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 pt-0 max-w-6xl mx-auto w-full">
        <ContactsClient
          leads={(leads ?? []) as unknown as Parameters<typeof ContactsClient>[0]["leads"]}
          primaryUsername={cardList[0]?.username}
          initialCardFilter={selectedCardParam ?? null}
          userCards={cardList.map((c) => ({ username: c.username, name: c.label || c.name || c.username }))}
        />
      </div>
    </div>
  );
}
