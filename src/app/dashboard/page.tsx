import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { ensureUserCards } from "@/lib/ensure-cards";
import { getSourceLabel } from "@/lib/source-labels";
import SignOutButton from "@/components/SignOutButton";
import CopyButton from "@/components/CopyButton";
import LeadPipeline from "@/components/LeadPipeline";
import NotificationBell from "@/components/NotificationBell";
import NotificationsPanel from "@/components/NotificationsPanel";
import CardScanner from "@/components/CardScanner";
import CSVImport from "@/components/CSVImport";
import MoreShareOptions from "@/components/MoreShareOptions";
import CardPreviewDownload from "@/components/CardPreviewDownload";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";
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
import { PLAN_LIMITS } from "@/lib/plan";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";
const FREE_LIMIT = PLAN_LIMITS.FREE_CONTACT_LIMIT;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; sort?: string; view?: string; status?: string; date?: string; range?: string; card?: string; surface?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const sortBy = params.sort ?? "newest";
  const view = params.view ?? "notifications";
  const filterStatus = params.status ?? "all";
  const filterDate = params.date ?? "all";
  const chartRange = params.range ?? "30d";
  const selectedCard = params.card ?? null;
  const surface = params.surface === "link" ? "link" : "card";

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/onboarding");
  if ((profile.customization as { _deleted?: boolean } | null)?._deleted) redirect("/account-deleted");

  const chartDays = chartRange === "7d" ? 7 : 30;
  const chartCutoff = new Date(Date.now() - chartDays * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Migrate any legacy "primary card" (stored on the profile) into the cards table,
  // then treat the cards table as the single source of truth — no primary card.
  await ensureUserCards(user.id);

  const { data: cards } = await getAdminSupabase()
    .from("cards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const allCards = cards ?? [];
  const hasCards = allCards.length > 0;

  // Active card: the explicitly-selected one. With exactly one card we auto-open it;
  // with 2+ cards and none selected (e.g. right after login) the user must pick one.
  const activeCard =
    allCards.find((c) => c.username === selectedCard) ?? (allCards.length === 1 ? allCards[0] : null);
  const activeSource = activeCard ?? profile;
  const activeUsername = (activeCard?.username ?? "") as string;
  const analyticsUsername = activeUsername;

  const isPro = profile.plan === "pro" || profile.plan === "enterprise";
  const isEnterprise = profile.plan === "enterprise";

  // No cards yet → show the "create your card" empty state.
  if (!hasCards) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />
        <nav className="fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60">
          <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SwiftCardIcon size={28} />
              <span className="font-bold text-white text-sm tracking-tight">SwiftCard</span>
            </div>
            <SignOutButton />
          </div>
        </nav>
        <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/15 border border-blue-600/30 flex items-center justify-center mb-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={1.5} className="w-8 h-8">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path strokeLinecap="round" d="M3 9.5h18" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Let&apos;s create your first card</h1>
          <p className="text-gray-400 text-sm mb-8 max-w-sm">Your digital business card — add your info, socials, and design in about a minute.</p>
          <Link href="/cards/new" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3.5 rounded-full text-sm transition-colors">
            Create your card →
          </Link>
        </main>
      </>
    );
  }

  // Has cards but none selected (e.g. right after login) → pick a card first.
  if (!activeCard) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />
        <nav className="fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60">
          <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SwiftCardIcon size={28} />
              <span className="font-bold text-white text-sm tracking-tight">SwiftCard</span>
            </div>
            <div className="flex items-center gap-2">
              <SignOutButton />
            </div>
          </div>
        </nav>
        <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-5 py-24">
          <div className="w-full max-w-sm">
            <h1 className="text-xl font-bold text-white mb-1 text-center">Select a card</h1>
            <p className="text-gray-500 text-sm mb-6 text-center">Choose a card to open its dashboard and contacts.</p>
            <div className="space-y-2">
              {allCards.map((card) => (
                <Link
                  key={card.id}
                  href={`/dashboard?card=${card.username}`}
                  className="flex items-center gap-3 rounded-xl px-4 py-3.5 border border-gray-800 bg-gray-900 hover:border-blue-600/50 hover:bg-gray-900/60 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 bg-gray-700 text-gray-300">
                    {(card.label || card.name || card.username)[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{card.label || card.name || card.username}</p>
                    <p className="text-gray-500 text-xs truncate">/{card.username}{card.name ? ` · ${card.name}` : ""}</p>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-600 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  // Swift Link views are tracked in card_views under a "<username>__links" key,
  // exactly the same way card views are tracked under the plain username.
  const linkUsername = `${analyticsUsername}__links`;

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
    { count: totalLinkViews },
    { data: recentLinkViews },
    { data: linkLocationViews },
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
    supabase.from("notifications").select("id, type, title, body, read, created_at").eq("user_id", user.id).or(`card_owner.eq.${activeUsername},card_owner.is.null`).order("created_at", { ascending: false }).limit(20),
    supabase.from("card_views").select("location").eq("username", analyticsUsername).not("location", "is", null).gte("viewed_at", thirtyDaysAgo),
    supabase.from("analytics_events").select("*", { count: "exact", head: true }).eq("username", analyticsUsername).eq("event_type", "contact_save"),
    getAdminSupabase().from("card_events").select("source, event_type").eq("card_owner_username", activeUsername).gte("created_at", thirtyDaysAgo),
    supabase.from("card_views").select("*", { count: "exact", head: true }).eq("username", linkUsername),
    supabase.from("card_views").select("viewed_at").eq("username", linkUsername).gte("viewed_at", chartCutoff),
    supabase.from("card_views").select("location").eq("username", linkUsername).not("location", "is", null).gte("viewed_at", thirtyDaysAgo),
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

  // Link views — same computations as card views, just from the "__links" key.
  const linkViewsByDate: Record<string, number> = {};
  for (const v of recentLinkViews ?? []) {
    const date = new Date(v.viewed_at).toISOString().split("T")[0];
    linkViewsByDate[date] = (linkViewsByDate[date] ?? 0) + 1;
  }
  const linkChartData = Array.from({ length: chartDays }, (_, i) => {
    const date = new Date(Date.now() - (chartDays - 1 - i) * 86400000).toISOString().split("T")[0];
    return { date, views: linkViewsByDate[date] ?? 0 };
  });
  const linkTotalLast30 = linkChartData.reduce((s, d) => s + d.views, 0);
  const linkLocationCounts: Record<string, number> = {};
  for (const v of linkLocationViews ?? []) {
    if (v.location) linkLocationCounts[v.location] = (linkLocationCounts[v.location] ?? 0) + 1;
  }
  const linkTopLocations = Object.entries(linkLocationCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const linkPeakViews = Math.max(...linkChartData.map((d) => d.views), 0);
  const linkViewsToday = linkChartData[linkChartData.length - 1].views;

  // The "Card views" widget can switch between the card and the Swift Link.
  const viewsPanel = surface === "link"
    ? { label: "Link views", chartData: linkChartData, total: linkTotalLast30, today: linkViewsToday, peak: linkPeakViews, topLocations: linkTopLocations, allTime: totalLinkViews ?? 0 }
    : { label: "Card views", chartData, total: totalViewsLast30, today: viewsToday, peak: peakViews, topLocations, allTime: totalViews ?? 0 };
  const surfaceQS = `&view=${view}&status=${filterStatus}&date=${filterDate}&sort=${sortBy}&range=${chartRange}${selectedCard ? `&card=${selectedCard}` : ""}`;

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

  const rawFlowSettings = (profile.flow_settings ?? {}) as Record<string, unknown>;
  const defaultPresets: FlowPresets = {
    "1": { name: "Warm Touch", days: [1, 2, 4, 7] },
    "2": { name: "Standard",   days: [1, 4, 10, 21, 45] },
    "3": { name: "Long-term",  days: [1, 30, 90, 180, 365] },
  };
  const flowPresets: FlowPresets = (rawFlowSettings.presets as FlowPresets) ?? defaultPresets;

  const atLimit = !isPro && allLeads.length >= FREE_LIMIT;
  const nearLimit = !isPro && allLeads.length >= FREE_LIMIT - 5;

  const { data: ownedOffice } = isEnterprise
    ? await supabase.from("offices").select("id, name").eq("owner_id", user.id).single()
    : { data: null };

  const cardUrl = `${APP_URL}/card/${activeUsername}`;
  const swiftUrl = `${APP_URL}/links/${activeUsername}`;

  function initials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  }

  const _addr = (activeSource.customization as { address?: { street?: string; unit?: string; city?: string; state?: string; zip?: string } } | null)?.address;
  const activeAddress = _addr
    ? [
        [_addr.street, _addr.unit ? `Unit ${_addr.unit}` : ""].filter(Boolean).join(", "),
        _addr.city ?? "",
        [_addr.state, _addr.zip].filter(Boolean).join(" "),
      ].filter(Boolean).join("\n")
    : "";

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
    address: activeAddress,
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
            <Link href={`/dashboard?card=${activeUsername}`} className="flex items-center gap-2">
              <SwiftCardIcon size={28} />
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
              { href: `/dashboard?card=${activeUsername}`, label: "Dashboard", active: true },
              { href: `/contacts?card=${activeUsername}`, label: "Contacts", active: false },
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
            <NotificationBell initialNotifications={notifications ?? []} activeCard={activeUsername} />
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
                {(isPro || allCards.length < PLAN_LIMITS.FREE_CARD_LIMIT) && (
                  <Link href="/cards/new" className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    + Add card
                  </Link>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {allCards.map((card) => {
                const isActive = activeUsername === card.username;
                return (
                  <div key={card.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all border flex-1 min-w-full sm:min-w-[200px] ${isActive ? "bg-blue-600/10 border-blue-600/40" : "bg-gray-800/60 border-gray-700/60"}`}>
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
              {!isPro && allCards.length >= PLAN_LIMITS.FREE_CARD_LIMIT && (
                <Link
                  href="/pricing"
                  className="group flex items-center justify-between border border-dashed border-gray-800 hover:border-blue-600/60 rounded-xl px-4 py-3 flex-1 min-w-full sm:min-w-[200px] transition-colors"
                >
                  <p className="text-gray-400 group-hover:text-gray-200 text-xs transition-colors">Free includes {PLAN_LIMITS.FREE_CARD_LIMIT} card — upgrade to Pro for unlimited cards</p>
                  <span className="text-xs text-blue-400 group-hover:text-blue-300 font-medium shrink-0 ml-2">Upgrade to Pro →</span>
                </Link>
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

              {/* Analytics chart */}
              <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
                {/* Card views / Link views toggle */}
                <div className="flex items-center bg-gray-800/80 rounded-lg p-0.5 mb-4 w-fit">
                  {([
                    { id: "card", label: "Card views" },
                    { id: "link", label: "Link views" },
                  ] as const).map((sf) => (
                    <Link key={sf.id} href={`?surface=${sf.id}${surfaceQS}`}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${surface === sf.id ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                      {sf.label}
                    </Link>
                  ))}
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white font-semibold text-sm">{viewsPanel.label}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{viewsPanel.total} {surface === "link" ? "link" : "card"} views in the last {chartDays} days</p>
                  </div>
                  <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
                    {(["7d", "30d"] as const).map((r) => (
                      <Link key={r} href={`?range=${r}&surface=${surface}&view=${view}&status=${filterStatus}&date=${filterDate}&sort=${sortBy}${selectedCard ? `&card=${selectedCard}` : ""}`}
                        className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${chartRange === r ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                        {r}
                      </Link>
                    ))}
                  </div>
                </div>
                <ViewsChart data={viewsPanel.chartData} />
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-800/80">
                  {[
                    { label: "Today", value: viewsPanel.today },
                    { label: surface === "link" ? "All time" : "Contact saves", value: surface === "link" ? viewsPanel.allTime : (contactSaves ?? 0) },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-white font-bold text-base">{s.value}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {isPro && viewsPanel.topLocations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-800/80">
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Top locations · 30d</p>
                    <div className="space-y-2">
                      {viewsPanel.topLocations.map(([loc, count]) => (
                        <div key={loc} className="flex items-center gap-3">
                          <p className="text-gray-300 text-xs flex-1 truncate">{loc}</p>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / viewsPanel.topLocations[0][1]) * 100}%` }} />
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

                {/* Traffic sources — Pro */}
                {!isPro && sourceBreakdown.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-800/80 flex items-center justify-between">
                    <p className="text-gray-600 text-xs">Traffic sources — Pro only</p>
                    <Link href="/pricing" className="text-xs text-blue-400 hover:text-blue-300 font-medium">Upgrade →</Link>
                  </div>
                )}
                {isPro && sourceBreakdown.length > 0 && (
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
                  <div className="flex items-baseline gap-2.5">
                    <h2 className="text-white font-semibold text-sm">Contacts</h2>
                    <span className="text-white font-bold text-lg tabular-nums">{allLeads.length}</span>
                    <span className="text-gray-500 text-[11px] font-medium">Total leads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isPro && (
                      <p className="text-gray-600 text-xs hidden sm:block">{allLeads.length}/{FREE_LIMIT} free</p>
                    )}
                    <AddContactModal cardOwner={activeUsername} />
                    {allLeads.length > 0 && (
                      isPro ? (
                        <a href={`/api/leads/export?username=${activeUsername}`}
                          className="text-xs text-gray-500 hover:text-white transition-colors border border-gray-800 hover:border-gray-600 px-3 py-1.5 rounded-lg">
                          Export
                        </a>
                      ) : (
                        <Link href="/pricing" title="CSV export is a Pro feature"
                          className="text-xs text-gray-500 hover:text-white transition-colors border border-gray-800 hover:border-gray-600 px-3 py-1.5 rounded-lg">
                          Export · Pro
                        </Link>
                      )
                    )}
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {/* View toggle */}
                  <div className="flex items-center bg-gray-800/80 rounded-lg p-0.5">
                    {[
                      { id: "notifications", label: "Notifications" },
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
                {view === "notifications" ? (
                  <NotificationsPanel initial={(notifications ?? []) as unknown as Parameters<typeof NotificationsPanel>[0]["initial"]} />
                ) : allLeads.length === 0 ? (
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

              {/* Swift Links — a separate link from the business card */}
              <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
                <p className="text-gray-600 text-[11px] mb-2 leading-relaxed">
                  Your Swift Links is a separate link from your card — your bio, all your socials, and your links in one place. Drop it in your Instagram/TikTok bio, email signature, anywhere.
                </p>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Swift Links</p>
                <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={1.8} className="w-3.5 h-3.5 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  <span className="text-blue-400 text-xs truncate flex-1">{swiftUrl.replace("https://", "")}</span>
                  <CopyButton text={swiftUrl} />
                </div>
                <a href={swiftUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-xs font-semibold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full py-2 transition-colors">
                  Open Swift Links →
                </a>
              </div>

              {/* Your card */}
              <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-4">Your Card</p>
                <CardPreviewDownload
                  data={cardData}
                  template={activeSource.template ?? "classic-pro"}
                  username={activeUsername}
                  previewUrl={cardUrl}
                />
              </div>

              {/* Share */}
              <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5 space-y-2">
                <ShareButton
                  url={cardUrl}
                  title="My SwiftCard"
                  text="Save my contact and connect with me instantly."
                  label="Share"
                />
                <MoreShareOptions url={cardUrl} />
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
