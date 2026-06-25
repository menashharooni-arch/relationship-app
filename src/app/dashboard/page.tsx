import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getSourceLabel } from "@/lib/source-labels";
import SignOutButton from "@/components/SignOutButton";
import CopyButton from "@/components/CopyButton";
import LeadPipeline from "@/components/LeadPipeline";
import NotificationBell from "@/components/NotificationBell";
import CardScanner from "@/components/CardScanner";
import CSVImport from "@/components/CSVImport";
import QRCard from "@/components/QRCard";
import QRDownloadButton from "@/components/QRDownloadButton";
import CardPreviewDownload from "@/components/CardPreviewDownload";
import UpgradeButton from "@/components/UpgradeButton";
import ViewsChart from "@/components/ViewsChart";
import ShareButton from "@/components/ShareButton";
import AddContactModal from "@/components/AddContactModal";
import LeadListClient from "@/components/LeadListClient";
import Link from "next/link";
import MobileNav from "@/components/MobileNav";
import PushSetup from "@/components/PushSetup";
import type { FlowPresets } from "@/components/LeadCard";
import CardSelectionPersist from "@/components/CardSelectionPersist";
import { Suspense } from "react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";
const FREE_LIMIT = 25;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; sort?: string; view?: string; status?: string; date?: string; range?: string; card?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const sortBy = params.sort ?? "newest";
  const view = params.view ?? "list";
  const filterStatus = params.status ?? "all";
  const filterDate = params.date ?? "all";
  const chartRange = params.range ?? "30d";
  const selectedCard = params.card ?? null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/onboarding");

  const chartDays = chartRange === "7d" ? 7 : 30;
  const chartCutoff = new Date(Date.now() - chartDays * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Every extra card the user has created (the profile itself is the "primary" card).
  // Use the admin client (like Settings) so this isn't affected by row-level security.
  const { data: extraCards } = await getAdminSupabase()
    .from("cards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  // Resolve the active dashboard card: the selected extra card, else the primary (profile) by default.
  const activeExtraCard =
    selectedCard && selectedCard !== profile.username
      ? (extraCards ?? []).find((c) => c.username === selectedCard) ?? null
      : null;
  const activeSource = activeExtraCard ?? profile;
  const activeUsername = activeSource.username as string;
  const analyticsUsername = activeUsername;

  const [
    { data: leads },
    { count: totalViews },
    { count: weekViews },
    { count: prevWeekViews },
    { data: recentViews },
    { data: notifications },
    { data: locationViews },
    { count: contactSaves },
    { data: sourceEvents },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, email, phone, company, message, location, notes, status, tags, source, follow_up_date, created_at, card_owner")
      .eq("card_owner", activeUsername)
      .order(
        sortBy === "name-asc" || sortBy === "name-desc" ? "name" : "created_at",
        { ascending: sortBy === "name-asc" || sortBy === "oldest" }
      ),
    supabase.from("card_views").select("*", { count: "exact", head: true }).eq("username", analyticsUsername),
    supabase.from("card_views").select("*", { count: "exact", head: true }).eq("username", analyticsUsername)
      .gte("viewed_at", sevenDaysAgo),
    supabase.from("card_views").select("*", { count: "exact", head: true }).eq("username", analyticsUsername)
      .gte("viewed_at", fourteenDaysAgo).lt("viewed_at", sevenDaysAgo),
    supabase.from("card_views").select("viewed_at").eq("username", analyticsUsername).gte("viewed_at", chartCutoff),
    supabase.from("notifications").select("id, type, title, body, read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("card_views").select("location").eq("username", analyticsUsername).not("location", "is", null).gte("viewed_at", thirtyDaysAgo),
    supabase.from("analytics_events").select("*", { count: "exact", head: true }).eq("username", analyticsUsername).eq("event_type", "contact_save"),
    getAdminSupabase().from("card_events").select("source, event_type").eq("card_owner_username", activeUsername).gte("created_at", thirtyDaysAgo),
  ]);

  const viewsByDate: Record<string, number> = {};
  for (const v of recentViews ?? []) {
    const date = new Date(v.viewed_at).toISOString().split("T")[0];
    viewsByDate[date] = (viewsByDate[date] ?? 0) + 1;
  }
  const chartData = Array.from({ length: chartDays }, (_, i) => {
    const date = new Date(Date.now() - (chartDays - 1 - i) * 86400000).toISOString().split("T")[0];
    return { date, views: viewsByDate[date] ?? 0 };
  });

  const totalViewsLast30 = chartData.reduce((s, d) => s + d.views, 0);

  const locationCounts: Record<string, number> = {};
  for (const v of locationViews ?? []) {
    if (v.location) locationCounts[v.location] = (locationCounts[v.location] ?? 0) + 1;
  }
  const topLocations = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const peakViews = Math.max(...chartData.map((d) => d.views), 0);
  const viewsToday = chartData[chartData.length - 1].views;
  const allLeads = leads ?? [];

  // Source breakdown: views and leads per source (last 30d)
  const viewsBySource: Record<string, number> = {};
  for (const e of sourceEvents ?? []) {
    if (e.event_type === "viewed_card" && e.source) {
      viewsBySource[e.source] = (viewsBySource[e.source] ?? 0) + 1;
    }
  }
  const leadsBySource: Record<string, number> = {};
  for (const l of allLeads) {
    const s = (l as { source?: string }).source ?? "direct_link";
    leadsBySource[s] = (leadsBySource[s] ?? 0) + 1;
  }
  const allSources = Array.from(new Set([...Object.keys(viewsBySource), ...Object.keys(leadsBySource)]));
  const sourceBreakdown = allSources
    .map((src) => ({ source: src, label: getSourceLabel(src), views: viewsBySource[src] ?? 0, leads: leadsBySource[src] ?? 0 }))
    .sort((a, b) => b.views - a.views || b.leads - a.leads)
    .slice(0, 8);
  const maxSourceViews = Math.max(...sourceBreakdown.map((s) => s.views), 1);

  const dateThreshold = filterDate === "today"
    ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    : filterDate === "week"
    ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    : filterDate === "month"
    ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const filteredLeads = allLeads.filter((l) => {
    if (filterStatus !== "all" && (l.status || "new_contact") !== filterStatus) return false;
    if (dateThreshold && l.created_at < dateThreshold) return false;
    return true;
  });

  const conversionRate =
    totalViewsLast30 > 0 ? ((allLeads.length / totalViewsLast30) * 100).toFixed(1) : "—";

  const rawFlowSettings = (profile.flow_settings ?? {}) as Record<string, unknown>;
  const defaultPresets: FlowPresets = {
    "1": { name: "Warm Touch", days: [1, 2, 4, 7] },
    "2": { name: "Standard",   days: [1, 4, 10, 21, 45] },
    "3": { name: "Long-term",  days: [1, 30, 90, 180, 365] },
  };
  const flowPresets: FlowPresets = (rawFlowSettings.presets as FlowPresets) ?? defaultPresets;

  const isPro = profile.plan === "pro" || profile.plan === "enterprise";
  const isEnterprise = profile.plan === "enterprise";
  const atLimit = !isPro && allLeads.length >= FREE_LIMIT;
  const nearLimit = !isPro && allLeads.length >= FREE_LIMIT - 5;

  const { data: ownedOffice } = isEnterprise
    ? await supabase.from("offices").select("id, name").eq("owner_id", user.id).single()
    : { data: null };

  const cardUrl = `${APP_URL}/card/${activeUsername}`;

  function initials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  }

  const cardData = {
    name: activeSource.name || "",
    title: activeSource.title || "",
    company: activeSource.company || "",
    phone: activeSource.phone || "",
    email: activeSource.email || "",
    website: activeSource.website || "",
    instagram: activeSource.instagram || "",
    twitter: activeSource.twitter || "",
    tiktok: activeSource.tiktok || "",
    linkedin: activeSource.linkedin || "",
    initials: activeSource.name ? initials(activeSource.name) : "SC",
    // One profile picture is shared across all cards (lives on the profile).
    photoUrl: profile.photo_url || null,
    logoUrl: activeSource.logo_url || null,
    cardUrl: `${APP_URL.replace("https://", "")}/card/${activeUsername}`,
    customization: activeSource.customization ?? {},
  };

  return (
    <>
      <Suspense>
        <CardSelectionPersist selectedCard={selectedCard} />
      </Suspense>

      {/* Top accent stripe */}
      <div className="fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />

      {/* Sticky navbar */}
      <nav className="fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-bold text-white text-sm tracking-tight hidden sm:block">SwiftCard</span>
            </Link>
            {isEnterprise ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white">Office</span>
            ) : (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPro ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500"}`}>
                {isPro ? "Pro" : "Free"}
              </span>
            )}
          </div>

          <div className="hidden md:flex items-center gap-0.5">
            {[
              { href: "/dashboard", label: "Dashboard", active: true },
              { href: "/contacts", label: "Contacts", active: false },
              { href: "/settings/flows", label: "Settings", active: false },
            ].map(({ href, label, active }) => (
              <Link key={href} href={href}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${active ? "text-white font-medium bg-gray-800" : "text-gray-400 hover:text-white hover:bg-gray-800/60"}`}>
                {label}
              </Link>
            ))}
            {ownedOffice && (
              <Link href="/office" className="text-sm text-purple-400 hover:text-purple-300 hover:bg-gray-800/60 px-3 py-1.5 rounded-lg transition-colors">
                Team
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isPro && <CardScanner cardOwner={activeUsername} />}
            {isEnterprise && <CSVImport />}
            <NotificationBell initialNotifications={notifications ?? []} />
            <div className="w-px h-4 bg-gray-800 mx-1 hidden sm:block" />
            <SignOutButton />
          </div>
        </div>
      </nav>

      <MobileNav />
      <main className="min-h-screen bg-gray-950 pt-20 pb-24 md:pb-12">
        <div className="max-w-5xl mx-auto px-5">

          {/* My Cards — full width, top of dashboard */}
          <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-semibold text-sm">My Cards</p>
                <p className="text-gray-600 text-xs mt-0.5">Check a card to view everything about it. Only one card can be selected at a time.</p>
              </div>
              <div className="flex items-center gap-3">
                {(isPro || (extraCards?.length ?? 0) < 2) && (
                  <Link href="/cards/new" className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    + Add card
                  </Link>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Primary card */}
              {(() => {
                const isActive = activeUsername === profile.username;
                return (
                  <Link
                    href={`?card=${profile.username}&view=${view}&status=${filterStatus}&date=${filterDate}&sort=${sortBy}`}
                    role="radio"
                    aria-checked={isActive}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all border flex-1 min-w-[200px] ${isActive ? "bg-blue-600/10 border-blue-600/40" : "bg-gray-800/60 border-gray-700/60 hover:border-gray-600"}`}
                  >
                    <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-blue-600 border-blue-600" : "border-gray-600"}`}>
                      {isActive && (
                        <svg viewBox="0 0 20 20" fill="white" className="w-3 h-3"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" /></svg>
                      )}
                    </span>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isActive ? "bg-blue-600/30 border border-blue-500/40 text-blue-300" : "bg-blue-600/20 border border-blue-600/30 text-blue-400"}`}>
                      {initials(profile.name || "SC")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">{profile.name}</p>
                      <p className="text-gray-500 text-xs truncate">/{profile.username} {profile.title ? `· ${profile.title}` : ""}</p>
                    </div>
                    <span className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full font-bold shrink-0">Primary</span>
                  </Link>
                );
              })()}
              {/* Extra cards */}
              {(extraCards ?? []).map((card) => {
                const isActive = activeUsername === card.username;
                return (
                  <div key={card.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all border flex-1 min-w-[200px] ${isActive ? "bg-blue-600/10 border-blue-600/40" : "bg-gray-800/60 border-gray-700/60"}`}>
                    <Link
                      href={`?card=${card.username}&view=${view}&status=${filterStatus}&date=${filterDate}&sort=${sortBy}`}
                      role="radio"
                      aria-checked={isActive}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-blue-600 border-blue-600" : "border-gray-600"}`}>
                        {isActive && (
                          <svg viewBox="0 0 20 20" fill="white" className="w-3 h-3"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" /></svg>
                        )}
                      </span>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isActive ? "bg-blue-600/30 border border-blue-500/40 text-blue-300" : "bg-gray-700 text-gray-400"}`}>
                        {(card.label || card.name || card.username)[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate">{card.label || card.name || card.username}</p>
                        <p className="text-gray-500 text-xs truncate">/{card.username}{card.name ? ` · ${card.name}` : ""}</p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-gray-700/60">
                      <Link href={`/cards/${card.id}/edit`} className="text-xs text-gray-500 hover:text-white transition-colors">Edit</Link>
                    </div>
                  </div>
                );
              })}
              {!isPro && (extraCards?.length ?? 0) >= 2 && (
                <div className="flex items-center justify-between border border-dashed border-gray-800 rounded-xl px-4 py-3 flex-1 min-w-[200px]">
                  <p className="text-gray-600 text-xs">Upgrade for unlimited cards</p>
                  <Link href="/pricing" className="text-xs text-blue-400 hover:text-blue-300 font-medium">Upgrade →</Link>
                </div>
              )}
            </div>
          </div>

          {/* Push notification opt-in */}
          <PushSetup />

          {/* Upgrade success banner */}
          {params.upgraded && (
            <div className="flex items-center gap-3 bg-green-950 border border-green-800/60 rounded-2xl px-5 py-3.5 mb-5">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 20 20" fill="#4ade80" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/></svg>
              </div>
              <p className="text-green-400 text-sm font-medium">Welcome to Pro! Your plan is now active.</p>
            </div>
          )}

          {/* Follow-up due today */}
          {(() => {
            const today = new Date().toISOString().split("T")[0];
            const due = allLeads.filter((l) => l.follow_up_date && l.follow_up_date.slice(0, 10) <= today);
            if (!due.length) return null;
            return (
              <div className="flex items-center justify-between gap-4 rounded-2xl px-5 py-3.5 mb-5 bg-blue-950/40 border border-blue-800/40">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">📅</span>
                  <p className="text-blue-300 text-sm font-medium">
                    {due.length === 1 ? `Follow up with ${due[0].name} today` : `${due.length} follow-ups due today`}
                  </p>
                </div>
                <Link href="?status=all&date=all&sort=newest" className="text-xs text-blue-400 hover:text-blue-200 font-semibold whitespace-nowrap">View →</Link>
              </div>
            );
          })()}

          {/* Free plan limit banner */}
          {!isPro && nearLimit && !atLimit && (
            <div className="flex items-center justify-between gap-4 rounded-2xl px-5 py-3.5 mb-5 bg-amber-950/40 border border-amber-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <p className="text-sm font-medium text-amber-400">
                  {allLeads.length}/{FREE_LIMIT} leads used — running low
                </p>
              </div>
              <UpgradeButton />
            </div>
          )}

          {/* Two-column layout: left=main, right=card panel */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-5">

              {/* Stats row */}
              {(() => {
                const ww = weekViews ?? 0;
                const pw = prevWeekViews ?? 0;
                const weekDelta = pw > 0 ? Math.round(((ww - pw) / pw) * 100) : null;
                const leadsThisWeek = allLeads.filter((l) => l.created_at >= sevenDaysAgo).length;
                const leadsLastWeek = allLeads.filter((l) => l.created_at >= fourteenDaysAgo && l.created_at < sevenDaysAgo).length;
                const leadsDelta = leadsLastWeek > 0 ? Math.round(((leadsThisWeek - leadsLastWeek) / leadsLastWeek) * 100) : null;

                function Trend({ delta }: { delta: number | null }) {
                  if (delta === null || delta === 0) return null;
                  const up = delta > 0;
                  return (
                    <span className={`text-[10px] font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}>
                      {up ? "↑" : "↓"} {Math.abs(delta)}%
                    </span>
                  );
                }

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Leads", value: allLeads.length, sub: "total", trend: leadsDelta },
                      { label: "Views", value: totalViews ?? 0, sub: "all time", trend: null },
                      { label: "This week", value: ww, sub: "views", trend: weekDelta },
                      { label: "Conversion", value: conversionRate !== "—" ? `${conversionRate}%` : "—", sub: "last 30d", trend: null },
                    ].map((s) => (
                      <div key={s.label} className="bg-gray-900 border border-gray-800/80 rounded-2xl px-4 py-4">
                        <p className="text-2xl font-bold text-white tabular-nums">{s.value}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-gray-400 text-xs font-medium">{s.label}</p>
                          {s.trend !== null && <Trend delta={s.trend} />}
                        </div>
                        <p className="text-gray-600 text-[10px] mt-0.5">{s.sub}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Analytics chart */}
              <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white font-semibold text-sm">Card views</p>
                    <p className="text-gray-500 text-xs mt-0.5">{totalViewsLast30} views in the last {chartDays} days</p>
                  </div>
                  <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
                    {(["7d", "30d"] as const).map((r) => (
                      <Link key={r} href={`?range=${r}&view=${view}&status=${filterStatus}&date=${filterDate}&sort=${sortBy}${selectedCard ? `&card=${selectedCard}` : ""}`}
                        className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${chartRange === r ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                        {r}
                      </Link>
                    ))}
                  </div>
                </div>
                <ViewsChart data={chartData} />
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-800/80">
                  {[
                    { label: "Today", value: viewsToday },
                    { label: "Best day", value: peakViews },
                    { label: "Contact saves", value: contactSaves ?? 0 },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-white font-bold text-base">{s.value}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {isPro && topLocations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-800/80">
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Top locations · 30d</p>
                    <div className="space-y-2">
                      {topLocations.map(([loc, count]) => (
                        <div key={loc} className="flex items-center gap-3">
                          <p className="text-gray-300 text-xs flex-1 truncate">{loc}</p>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / topLocations[0][1]) * 100}%` }} />
                            </div>
                            <span className="text-gray-500 text-xs w-5 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!isPro && (
                  <div className="mt-4 pt-4 border-t border-gray-800/80 flex items-center justify-between">
                    <p className="text-gray-600 text-xs">Location breakdown — Pro only</p>
                    <Link href="/pricing" className="text-xs text-blue-400 hover:text-blue-300 font-medium">Upgrade →</Link>
                  </div>
                )}

                {/* Traffic sources */}
                {sourceBreakdown.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-800/80">
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Traffic sources · 30d</p>
                    <div className="space-y-3">
                      {sourceBreakdown.map(({ source: src, label, views, leads }) => (
                        <div key={src}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-gray-300 text-xs truncate max-w-[60%]">{label}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-gray-500 text-xs">{views} view{views !== 1 ? "s" : ""}</span>
                              {leads > 0 && (
                                <span className="text-emerald-400 text-xs font-semibold">{leads} lead{leads !== 1 ? "s" : ""}</span>
                              )}
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${Math.max((views / maxSourceViews) * 100, 3)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Contacts section */}
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-white font-semibold text-sm">Contacts</h2>
                    <span className="bg-gray-800 text-gray-400 text-xs font-bold px-2 py-0.5 rounded-full">
                      {allLeads.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isPro && (
                      <p className="text-gray-600 text-xs hidden sm:block">{allLeads.length}/{FREE_LIMIT} free</p>
                    )}
                    <AddContactModal />
                    {allLeads.length > 0 && (
                      <a href={`/api/leads/export?username=${activeUsername}`}
                        className="text-xs text-gray-500 hover:text-white transition-colors border border-gray-800 hover:border-gray-600 px-3 py-1.5 rounded-lg">
                        Export
                      </a>
                    )}
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {/* View toggle */}
                  <div className="flex items-center bg-gray-800/80 rounded-lg p-0.5">
                    {[
                      { id: "list", label: "List" },
                      { id: "pipeline", label: "Pipeline" },
                    ].map((v) => (
                      <Link key={v.id} href={`?view=${v.id}&status=${filterStatus}&date=${filterDate}&sort=${sortBy}${selectedCard ? `&card=${selectedCard}` : ""}`}
                        className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${view === v.id ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                        {v.label}
                      </Link>
                    ))}
                  </div>

                  {/* Status filters */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {[
                      { id: "all",         label: "All" },
                      { id: "new_contact", label: "New Contact" },
                      { id: "touch",       label: "Touch" },
                      { id: "dissolved",   label: "Dissolved" },
                    ].map((s) => (
                      <Link key={s.id} href={`?view=${view}&status=${s.id}&date=${filterDate}&sort=${sortBy}${selectedCard ? `&card=${selectedCard}` : ""}`}
                        className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filterStatus === s.id ? "bg-blue-600 text-white font-medium" : "text-gray-500 hover:text-gray-300 bg-gray-800/60"}`}>
                        {s.label}
                      </Link>
                    ))}
                  </div>

                  {/* Date filter */}
                  <div className="ml-auto flex items-center gap-1">
                    {[
                      { id: "all", label: "All" },
                      { id: "month", label: "30d" },
                      { id: "week", label: "7d" },
                      { id: "today", label: "Today" },
                    ].map((d) => (
                      <Link key={d.id} href={`?view=${view}&status=${filterStatus}&date=${d.id}&sort=${sortBy}${selectedCard ? `&card=${selectedCard}` : ""}`}
                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${filterDate === d.id ? "bg-gray-700 text-white" : "text-gray-600 hover:text-gray-300"}`}>
                        {d.label}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Lead list */}
                {allLeads.length === 0 ? (
                  <div className="border border-dashed border-gray-800 rounded-2xl p-8">
                    <div className="text-center mb-6">
                      <div className="w-10 h-10 bg-gray-800/60 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-gray-600">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                        </svg>
                      </div>
                      <p className="font-semibold text-gray-300 text-sm mb-1">Share your card to get your first contact</p>
                      <p className="text-gray-600 text-xs mb-5">Send your link, show your QR code, or tap NFC — contacts appear here instantly.</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5">
                        <svg viewBox="0 0 16 16" fill="#3b82f6" className="w-3.5 h-3.5 shrink-0"><path d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8S12.42 0 8 0zm1 11.93V13H7v-1.07A6.003 6.003 0 012.07 7H4v-.5h-.93A6.003 6.003 0 017 1.07V2h2v1.07A6.003 6.003 0 0113.93 6.5H12V7h1.93A6.003 6.003 0 019 11.93z"/></svg>
                        <span className="text-blue-400 text-xs truncate flex-1">{cardUrl.replace("https://", "")}</span>
                        <CopyButton text={cardUrl} />
                      </div>
                      <a
                        href={cardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold transition-colors"
                        style={{ background: "#1D4ED8", color: "#fff" }}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        Preview your card
                      </a>
                    </div>
                  </div>
                ) : view === "pipeline" ? (
                  <LeadPipeline initialLeads={filteredLeads} />
                ) : (
                  <LeadListClient
                    leads={filteredLeads}
                    flowPresets={flowPresets}
                    sortBy={sortBy}
                    totalCount={allLeads.length}
                    isPro={isPro}
                  />
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN — sticky card panel ── */}
            <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">

              {/* Your card */}
              <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-4">Your Card</p>

                {/* Card preview */}
                <CardPreviewDownload
                  data={cardData}
                  template={activeSource.template ?? "classic-pro"}
                  username={activeUsername}
                />

                {/* Card URL */}
                <div className="mt-4 flex items-center gap-2 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5">
                  <svg viewBox="0 0 16 16" fill="#3b82f6" className="w-3.5 h-3.5 shrink-0"><path d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8S12.42 0 8 0zm1 11.93V13H7v-1.07A6.003 6.003 0 012.07 7H4v-.5h-.93A6.003 6.003 0 017 1.07V2h2v1.07A6.003 6.003 0 0113.93 6.5H12V7h1.93A6.003 6.003 0 019 11.93z"/></svg>
                  <span className="text-blue-400 text-xs truncate flex-1">{cardUrl.replace("https://", "")}</span>
                  <CopyButton text={cardUrl} />
                </div>

                {/* Actions */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <ShareButton
                    url={cardUrl}
                    title="My SwiftCard"
                    text="Save my contact and connect with me instantly."
                    label="Share"
                  />
                  <a href={cardUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl py-2 transition-colors">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M6.75 1a.75.75 0 01.75.75V3h1V1.75a.75.75 0 011.5 0V3H11a2 2 0 012 2v7.5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h1.25V1.75A.75.75 0 016.75 1zM5 4.5a.5.5 0 00-.5.5v7.5a.5.5 0 00.5.5h6a.5.5 0 00.5-.5V5a.5.5 0 00-.5-.5H5z"/></svg>
                    Preview
                  </a>
                </div>
              </div>

              {/* QR Code */}
              <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">QR Code</p>
                <QRCard url={cardUrl} />
                <div className="mt-3">
                  <QRDownloadButton url={cardUrl} />
                </div>
              </div>

              {/* Quick links */}
              <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Quick links</p>
                <div className="space-y-1">
                  {[
                    { href: "/profile", icon: "✏️", label: "Edit card info" },
                    { href: "/templates", icon: "🎨", label: "Change card design" },
                    { href: "/settings/flows", icon: "⚡", label: "Follow-up settings" },
                    { href: "/contacts", icon: "👥", label: "Contact book" },
                    ...(!isPro ? [{ href: "/pricing", icon: "⭐", label: "Upgrade to Pro" }] : []),
                  ].map(({ href, icon, label }) => (
                    <Link key={href} href={href}
                      className="flex items-center gap-2.5 text-sm text-gray-400 hover:text-white px-2 py-2 rounded-lg hover:bg-gray-800/60 transition-colors">
                      <span className="text-base leading-none">{icon}</span>
                      {label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Share links by platform */}
              <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Share links</p>
                <p className="text-gray-600 text-xs mb-4 leading-relaxed">Copy a link for each platform — each tracks exactly where your leads come from.</p>
                <div className="space-y-2">
                  {[
                    { label: "Instagram bio",   source: "instagram_bio",   emoji: "📸" },
                    { label: "TikTok bio",      source: "tiktok",          emoji: "🎵" },
                    { label: "LinkedIn",        source: "linkedin",        emoji: "💼" },
                    { label: "Snapchat",        source: "snapchat",        emoji: "👻" },
                    { label: "Email signature", source: "email_signature", emoji: "✉️" },
                    { label: "QR code / print", source: "qr_code",        emoji: "⬛" },
                  ].map(({ label, source, emoji }) => (
                    <div key={source} className="flex items-center gap-2 bg-gray-800/50 border border-gray-700/50 rounded-xl px-3 py-2">
                      <span className="text-sm shrink-0">{emoji}</span>
                      <p className="text-gray-400 text-[11px] flex-1 truncate font-medium">{label}</p>
                      <CopyButton text={`${cardUrl}?source=${source}`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Refer a friend */}
              <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Refer a friend</p>
                <p className="text-gray-600 text-xs mb-3 leading-relaxed">Know someone who networks a lot? Share SwiftCard — if they sign up, you&apos;re helping a friend level up their game.</p>
                <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 mb-2">
                  <p className="text-gray-400 text-[11px] font-mono break-all truncate">{`${APP_URL}/login?mode=signup&ref=${profile.username}`}</p>
                </div>
                <CopyButton text={`${APP_URL}/login?mode=signup&ref=${profile.username}`} />
              </div>
            </div>

          </div>
        </div>
      </main>
    </>
  );
}
