import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";
import CopyButton from "@/components/CopyButton";
import LeadCard from "@/components/LeadCard";
import QRCard from "@/components/QRCard";
import QRDownloadButton from "@/components/QRDownloadButton";
import UpgradeButton from "@/components/UpgradeButton";
import ViewsChart from "@/components/ViewsChart";
import ShareButton from "@/components/ShareButton";
import SortSelect from "@/components/SortSelect";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";
const FREE_LIMIT = 25;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; sort?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const sortBy = params.sort ?? "newest";

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/onboarding");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: leads },
    { count: totalViews },
    { count: weekViews },
    { data: recentViews },
    { data: extraCards },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, email, phone, notes, status, follow_up_date, created_at")
      .eq("card_owner", profile.username)
      .order(
        sortBy === "name-asc" || sortBy === "name-desc" ? "name" : "created_at",
        { ascending: sortBy === "name-asc" || sortBy === "oldest" }
      ),
    supabase
      .from("card_views")
      .select("*", { count: "exact", head: true })
      .eq("username", profile.username),
    supabase
      .from("card_views")
      .select("*", { count: "exact", head: true })
      .eq("username", profile.username)
      .gte("viewed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("card_views")
      .select("viewed_at")
      .eq("username", profile.username)
      .gte("viewed_at", thirtyDaysAgo),
    supabase
      .from("cards")
      .select("id, username, name, title, company")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  // Build 30-day chart data
  const viewsByDate: Record<string, number> = {};
  for (const v of recentViews ?? []) {
    const date = new Date(v.viewed_at).toISOString().split("T")[0];
    viewsByDate[date] = (viewsByDate[date] ?? 0) + 1;
  }
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.now() - (29 - i) * 86400000).toISOString().split("T")[0];
    return { date, views: viewsByDate[date] ?? 0 };
  });

  const totalViewsLast30 = chartData.reduce((s, d) => s + d.views, 0);
  const peakViews = Math.max(...chartData.map((d) => d.views), 0);
  const viewsToday = chartData[chartData.length - 1].views;
  const allLeads = leads ?? [];
  const conversionRate =
    totalViewsLast30 > 0
      ? ((allLeads.length / totalViewsLast30) * 100).toFixed(1)
      : "—";

  const isPro = profile.plan === "pro" || profile.plan === "enterprise";
  const isEnterprise = profile.plan === "enterprise";
  const atLimit = !isPro && allLeads.length >= FREE_LIMIT;
  const nearLimit = !isPro && allLeads.length >= FREE_LIMIT - 5;

  // Check if this enterprise user is the office owner
  const { data: ownedOffice } = isEnterprise
    ? await supabase.from("offices").select("id, name").eq("owner_id", user.id).single()
    : { data: null };

  const cardUrl = `${APP_URL}/card/${profile.username}`;

  return (
    <main className="min-h-screen bg-gray-950 px-5 py-10">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-gray-500 uppercase mb-1">Kontact</p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              {isEnterprise ? (
                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                  </svg>
                  Office Plan
                </span>
              ) : (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPro ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
                  {isPro ? "Pro" : "Free"}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/templates" className="text-sm text-gray-400 hover:text-white transition-colors">Card design</Link>
            <Link href="/profile" className="text-sm text-gray-400 hover:text-white transition-colors">Edit card</Link>
            <Link href="/settings/flows" className="text-sm text-gray-400 hover:text-white transition-colors">Flows</Link>
            {ownedOffice && (
              <Link href="/office" className="text-sm text-purple-400 hover:text-purple-300 font-medium transition-colors">Team</Link>
            )}
            <SignOutButton />
          </div>
        </div>

        {/* Upgrade success */}
        {params.upgraded && (
          <div className="bg-green-900/30 border border-green-700/50 rounded-2xl px-5 py-4 mb-5 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            <p className="text-green-300 text-sm font-medium">
              Welcome to Pro! Your plan is now active.
            </p>
          </div>
        )}

        {/* Free plan banner */}
        {!isPro && (
          <div className={`rounded-2xl px-5 py-4 mb-5 flex items-center justify-between gap-4 ${atLimit ? "bg-red-900/30 border border-red-700/50" : "bg-blue-950/50 border border-blue-800/40"}`}>
            <div>
              <p className={`font-semibold text-sm ${atLimit ? "text-red-300" : "text-white"}`}>
                {atLimit ? "Lead limit reached" : "Free Plan"}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">
                {allLeads.length} / {FREE_LIMIT} leads used
                {atLimit ? " — upgrade to capture more" : nearLimit ? " — almost full" : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/pricing" className="text-xs text-gray-400 hover:text-white transition-colors">See plans</Link>
              <UpgradeButton />
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total leads", value: allLeads.length },
            { label: "Card views", value: totalViews ?? 0 },
            { label: "Views this week", value: weekViews ?? 0 },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-4 text-center">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-gray-500 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Analytics chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Card views · Last 30 days</p>
            <span className="text-gray-600 text-xs">{totalViewsLast30} total</span>
          </div>

          <ViewsChart data={chartData} />

          <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-gray-800">
            <div>
              <p className="text-white font-bold text-lg">{viewsToday}</p>
              <p className="text-gray-500 text-xs mt-0.5">Views today</p>
            </div>
            <div>
              <p className="text-white font-bold text-lg">{peakViews}</p>
              <p className="text-gray-500 text-xs mt-0.5">Best day</p>
            </div>
            <div>
              <p className="text-white font-bold text-lg">{conversionRate}{conversionRate !== "—" ? "%" : ""}</p>
              <p className="text-gray-500 text-xs mt-0.5">Lead conversion</p>
            </div>
          </div>
        </div>

        {/* Share your card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-4">Share your card</p>

          {/* Primary share button */}
          <ShareButton
            url={cardUrl}
            title="My Kontact card"
            text="Save my contact and connect with me instantly."
            label="Share Card"
          />

          {/* Copy link row */}
          <div className="flex items-center gap-3 bg-gray-950 rounded-xl px-4 py-3 mt-3">
            <span className="text-blue-400 text-sm truncate flex-1">{cardUrl}</span>
            <CopyButton text={cardUrl} />
          </div>

          <a href={cardUrl} target="_blank" rel="noopener noreferrer"
            className="block text-center text-xs text-gray-500 hover:text-white transition-colors mt-3">
            Preview your live card →
          </a>
        </div>

        {/* QR code + download */}
        <div className="mb-6 space-y-3">
          <QRCard url={cardUrl} />
          <QRDownloadButton url={cardUrl} />
        </div>

        {/* My Cards */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">My Cards</p>
            {isPro && (extraCards?.length ?? 0) < 2 && (
              <Link href="/cards/new" className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
                + Add card
              </Link>
            )}
          </div>

          <div className="space-y-2">
            {/* Primary card (from profile) */}
            <div className="flex items-center justify-between bg-gray-950 rounded-xl px-4 py-3">
              <div>
                <p className="text-white text-sm font-semibold">{profile.name}</p>
                <p className="text-gray-500 text-xs">{profile.title || "Primary card"} · /{profile.username}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">Primary</span>
                <Link href="/profile" className="text-xs text-gray-500 hover:text-white transition-colors">Edit</Link>
              </div>
            </div>

            {/* Extra cards */}
            {(extraCards ?? []).map((card) => (
              <div key={card.id} className="flex items-center justify-between bg-gray-950 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white text-sm font-semibold">{card.name || card.username}</p>
                  <p className="text-gray-500 text-xs">{card.title || card.company || "Extra card"} · /{card.username}</p>
                </div>
                <a href={`${APP_URL}/card/${card.username}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-white transition-colors">
                  View →
                </a>
              </div>
            ))}

            {/* Upgrade prompt for free users */}
            {!isPro && (
              <div className="flex items-center justify-between border border-dashed border-gray-700 rounded-xl px-4 py-3">
                <p className="text-gray-600 text-xs">Pro users can create up to 3 cards</p>
                <Link href="/pricing" className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
                  Upgrade →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Leads header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">Leads</h2>
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
              {allLeads.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {allLeads.length > 1 && <SortSelect value={sortBy} />}
            {/* Status legend */}
            <div className="hidden sm:flex items-center gap-3">
              {(["hot", "warm", "cold", "closed"] as const).map((s) => {
                const colors: Record<string, string> = { hot: "#fca5a5", warm: "#fcd34d", cold: "#93c5fd", closed: "#86efac" };
                return (
                  <span key={s} className="text-[10px] font-medium capitalize" style={{ color: colors[s] }}>{s}</span>
                );
              })}
            </div>
            {allLeads.length > 0 && (
              <a href={`/api/leads/export?username=${profile.username}`}
                className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg">
                Export CSV
              </a>
            )}
          </div>
        </div>

        {allLeads.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl text-gray-600">
            <p className="font-medium text-gray-500 mb-1">No leads yet</p>
            <p className="text-sm">Share your card link or QR code to start collecting.</p>
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
