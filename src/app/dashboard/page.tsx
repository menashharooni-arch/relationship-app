import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";
import CopyButton from "@/components/CopyButton";
import LeadCard from "@/components/LeadCard";
import LeadPipeline from "@/components/LeadPipeline";
import NotificationBell from "@/components/NotificationBell";
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
  searchParams: Promise<{ upgraded?: string; sort?: string; view?: string; status?: string; date?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const sortBy = params.sort ?? "newest";
  const view = params.view ?? "list";
  const filterStatus = params.status ?? "all";
  const filterDate = params.date ?? "all";

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
    { data: notifications },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, email, phone, message, location, notes, status, tags, follow_up_date, created_at")
      .eq("card_owner", profile.username)
      .order(
        sortBy === "name-asc" || sortBy === "name-desc" ? "name" : "created_at",
        { ascending: sortBy === "name-asc" || sortBy === "oldest" }
      ),
    supabase.from("card_views").select("*", { count: "exact", head: true }).eq("username", profile.username),
    supabase.from("card_views").select("*", { count: "exact", head: true }).eq("username", profile.username)
      .gte("viewed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("card_views").select("viewed_at").eq("username", profile.username).gte("viewed_at", thirtyDaysAgo),
    supabase.from("cards").select("id, username, name, title, company").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("notifications").select("id, type, title, body, read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);

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

  // Apply filters server-side
  const dateThreshold = filterDate === "today"
    ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    : filterDate === "week"
    ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    : filterDate === "month"
    ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const filteredLeads = allLeads.filter((l) => {
    if (filterStatus !== "all" && (l.status || "new") !== filterStatus) return false;
    if (dateThreshold && l.created_at < dateThreshold) return false;
    return true;
  });

  const conversionRate =
    totalViewsLast30 > 0 ? ((allLeads.length / totalViewsLast30) * 100).toFixed(1) : "—";

  const isPro = profile.plan === "pro" || profile.plan === "enterprise";
  const isEnterprise = profile.plan === "enterprise";
  const atLimit = !isPro && allLeads.length >= FREE_LIMIT;
  const nearLimit = !isPro && allLeads.length >= FREE_LIMIT - 5;

  const { data: ownedOffice } = isEnterprise
    ? await supabase.from("offices").select("id, name").eq("owner_id", user.id).single()
    : { data: null };

  const cardUrl = `${APP_URL}/card/${profile.username}`;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-blue-600 uppercase mb-1">Kontact</p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              {isEnterprise ? (
                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                  </svg>
                  Office Plan
                </span>
              ) : (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPro ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {isPro ? "Pro" : "Free"}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/templates" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Card design</Link>
            <Link href="/profile" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Edit card</Link>
            <Link href="/settings/flows" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Flows</Link>
            {ownedOffice && (
              <Link href="/office" className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors">Team</Link>
            )}
            <NotificationBell initialNotifications={notifications ?? []} />
            <SignOutButton />
          </div>
        </div>

        {/* Upgrade success */}
        {params.upgraded && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-5 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <p className="text-green-700 text-sm font-medium">Welcome to Pro! Your plan is now active.</p>
          </div>
        )}

        {/* Free plan banner */}
        {!isPro && (
          <div className={`rounded-2xl px-5 py-4 mb-5 flex items-center justify-between gap-4 ${atLimit ? "bg-red-50 border border-red-200" : "bg-blue-50 border border-blue-200"}`}>
            <div>
              <p className={`font-semibold text-sm ${atLimit ? "text-red-700" : "text-slate-900"}`}>
                {atLimit ? "Lead limit reached" : "Free Plan"}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                {allLeads.length} / {FREE_LIMIT} leads used
                {atLimit ? " — upgrade to capture more" : nearLimit ? " — almost full" : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/pricing" className="text-xs text-slate-500 hover:text-slate-900 transition-colors">See plans</Link>
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
            <div key={s.label} className="bg-white border border-slate-200 rounded-2xl px-4 py-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-slate-500 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Analytics chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Card views · Last 30 days</p>
            <span className="text-slate-400 text-xs">{totalViewsLast30} total</span>
          </div>
          <ViewsChart data={chartData} />
          <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-100">
            <div>
              <p className="text-slate-900 font-bold text-lg">{viewsToday}</p>
              <p className="text-slate-500 text-xs mt-0.5">Views today</p>
            </div>
            <div>
              <p className="text-slate-900 font-bold text-lg">{peakViews}</p>
              <p className="text-slate-500 text-xs mt-0.5">Best day</p>
            </div>
            <div>
              <p className="text-slate-900 font-bold text-lg">{conversionRate}{conversionRate !== "—" ? "%" : ""}</p>
              <p className="text-slate-500 text-xs mt-0.5">Lead conversion</p>
            </div>
          </div>
        </div>

        {/* Share your card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-4">Share your card</p>
          <ShareButton
            url={cardUrl}
            title="My Kontact card"
            text="Save my contact and connect with me instantly."
            label="Share Card"
          />
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mt-3">
            <span className="text-blue-600 text-sm truncate flex-1">{cardUrl}</span>
            <CopyButton text={cardUrl} />
          </div>
          <a href={cardUrl} target="_blank" rel="noopener noreferrer"
            className="block text-center text-xs text-slate-400 hover:text-slate-700 transition-colors mt-3">
            Preview your live card →
          </a>
        </div>

        {/* QR code + download */}
        <div className="mb-6 space-y-3">
          <QRCard url={cardUrl} />
          <QRDownloadButton url={cardUrl} />
        </div>

        {/* My Cards */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">My Cards</p>
            {isPro && (extraCards?.length ?? 0) < 2 && (
              <Link href="/cards/new" className="text-xs text-blue-600 hover:text-blue-700 transition-colors font-medium">
                + Add card
              </Link>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-slate-900 text-sm font-semibold">{profile.name}</p>
                <p className="text-slate-500 text-xs">{profile.title || "Primary card"} · /{profile.username}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">Primary</span>
                <Link href="/profile" className="text-xs text-slate-500 hover:text-slate-900 transition-colors">Edit</Link>
              </div>
            </div>
            {(extraCards ?? []).map((card) => (
              <div key={card.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <div>
                  <p className="text-slate-900 text-sm font-semibold">{card.name || card.username}</p>
                  <p className="text-slate-500 text-xs">{card.title || card.company || "Extra card"} · /{card.username}</p>
                </div>
                <a href={`${APP_URL}/card/${card.username}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-slate-900 transition-colors">
                  View →
                </a>
              </div>
            ))}
            {!isPro && (
              <div className="flex items-center justify-between border border-dashed border-slate-300 rounded-xl px-4 py-3">
                <p className="text-slate-400 text-xs">Pro users can create up to 3 cards</p>
                <Link href="/pricing" className="text-xs text-blue-600 hover:text-blue-700 transition-colors font-medium">
                  Upgrade →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Contacts header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">Contacts</h2>
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
              {allLeads.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {allLeads.length > 0 && (
              <a href={`/api/leads/export?username=${profile.username}`}
                className="text-xs text-slate-500 hover:text-slate-900 transition-colors border border-slate-200 hover:border-slate-400 px-3 py-1.5 rounded-lg">
                Export CSV
              </a>
            )}
          </div>
        </div>

        {/* Filters + view toggle */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 mr-1">
            <Link
              href={`?view=list&status=${filterStatus}&date=${filterDate}&sort=${sortBy}`}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${view === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              List
            </Link>
            <Link
              href={`?view=pipeline&status=${filterStatus}&date=${filterDate}&sort=${sortBy}`}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${view === "pipeline" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Pipeline
            </Link>
          </div>

          {/* Status filter */}
          <Link href={`?view=${view}&status=all&date=${filterDate}&sort=${sortBy}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === "all" ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}>
            All
          </Link>
          {[
            { id: "new", label: "New" },
            { id: "warm", label: "Contacted" },
            { id: "hot", label: "Hot" },
            { id: "cold", label: "Follow Up" },
            { id: "closed", label: "Archived" },
          ].map((s) => (
            <Link key={s.id} href={`?view=${view}&status=${s.id}&date=${filterDate}&sort=${sortBy}`}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === s.id ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}>
              {s.label}
            </Link>
          ))}

          {/* Date filter */}
          <div className="ml-auto flex items-center gap-1">
            {[
              { id: "all", label: "All time" },
              { id: "month", label: "30d" },
              { id: "week", label: "7d" },
              { id: "today", label: "Today" },
            ].map((d) => (
              <Link key={d.id} href={`?view=${view}&status=${filterStatus}&date=${d.id}&sort=${sortBy}`}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${filterDate === d.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-700"}`}>
                {d.label}
              </Link>
            ))}
          </div>
        </div>

        {allLeads.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-300 rounded-2xl">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p className="font-semibold text-slate-600 mb-1">No contacts yet</p>
            <p className="text-sm text-slate-400">Share your card link or QR code to start collecting.</p>
          </div>
        ) : view === "pipeline" ? (
          <LeadPipeline initialLeads={filteredLeads} />
        ) : (
          <>
            {allLeads.length > 1 && <div className="mb-3"><SortSelect value={sortBy} /></div>}
            {filteredLeads.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-10">No contacts match this filter.</p>
            ) : (
              <div className="space-y-3">
                {filteredLeads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
