import { redirect } from "next/navigation";
import { cardSlug, prettyCardSlug } from "@/lib/slug";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase-server";
import { safeTimeZone, localDayKey, startOfLocalDayUtc } from "@/lib/tz-days";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { ensureUserCards } from "@/lib/ensure-cards";
import { canViewOfficeAdmin } from "@/lib/office-roles";
import SignOutButton from "@/components/SignOutButton";
import CopyButton from "@/components/CopyButton";
import NotificationBell from "@/components/NotificationBell";
import NotificationsPanel from "@/components/NotificationsPanel";
import MoreShareOptions from "@/components/MoreShareOptions";
import CardPreviewDownload from "@/components/CardPreviewDownload";
import { CardCaptureProvider } from "@/components/CardCaptureContext";
import GuestDraftClaim from "@/components/GuestDraftClaim";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";
import UpgradeButton from "@/components/UpgradeButton";
import ShareButton from "@/components/ShareButton";
import GrowLinkButton from "@/components/GrowLinkButton";
import SettingsLinkButton from "@/components/SettingsLinkButton";
import ShareCardCapture from "@/components/ShareCardCapture";
import TrafficChart from "@/components/TrafficChart";
import TimezoneCookie from "@/components/TimezoneCookie";
import ThemeToggle from "@/components/ThemeToggle";
import AppStorePopup from "@/components/AppStorePopup";
import IapProbe from "@/components/IapProbe";
import FirstLeadNudge from "@/components/FirstLeadNudge";
import TourBanner from "@/components/TourBanner";
import TourAutoStart from "@/components/TourAutoStart";
import MyCardsList from "@/components/dashboard/MyCardsList";
import TrialBanner from "@/components/TrialBanner";
import { hasWalletConfig } from "@/lib/wallet-config";
import TrackEvent from "@/components/TrackEvent";
import AddContactModal from "@/components/AddContactModal";
import QuickContactList from "@/components/QuickContactList";
import Link from "next/link";
import MobileNavGate from "@/components/MobileNavGate";
import HelpWidget from "@/components/HelpWidget";
import { PlanGate, PlanNotice } from "@/components/PlanGate";
import CardSelectionPersist from "@/components/CardSelectionPersist";
import TourContextPersist from "@/components/TourContextPersist";
import { Suspense } from "react";
import { PLAN_LIMITS, LOCKED_LEAD_TAG, isPaidPlan } from "@/lib/plan";
import { readUsage } from "@/lib/usage";
import { backfillCardPhotos } from "@/lib/card-media";
import { buildCardData } from "@/lib/card-data";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const FREE_LIMIT = PLAN_LIMITS.FREE_LEADS_PER_MONTH;

function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}
function daysAgoISO(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; sort?: string; view?: string; range?: string; card?: string; surface?: string; vrange?: string; welcome?: string; claim?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const sortBy = params.sort ?? "newest";
  const view = params.view ?? "notifications";
  const selectedCard = params.card ?? null;
  const viewsRange: "today" | "week" | "month" | "locations" =
    params.vrange === "week" || params.vrange === "month" || params.vrange === "locations" ? params.vrange : "today";

  // The user id comes from getClaims — a LOCAL ES256 verify against the
  // cached JWKS, zero network — so the DB queries below can start
  // immediately. getUser() (the full server-side check that catches a
  // hard-deleted account whose access token is still live) still runs, but IN
  // PARALLEL with those queries instead of serially before them: it used to
  // be a 200-600ms round-trip paid before any data moved, on every dashboard
  // open AND every card open (?card= re-renders this page).
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");
  const authedUserId = claimsData.claims.sub;

  // Profile + cards are both keyed only to user.id, so fetch them together — one
  // parallel batch instead of two sequential round-trips (a real TTFB win on
  // mobile/cellular). For the common already-migrated account this initial cards
  // read is final; the rare migration paths below mutate the table and re-read.
  const adminDb = getAdminSupabase();
  const cardsQuery = () =>
    adminDb.from("cards").select("*").eq("user_id", authedUserId).order("created_at", { ascending: true });
  const [{ data: { user } }, { data: profile }, cardsRes0] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("*").eq("id", authedUserId).single(),
    cardsQuery(),
  ]);
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");
  if ((profile.customization as { _deleted?: boolean } | null)?._deleted) redirect("/account-deleted");

  // Migrate any legacy "primary card" (stored on the profile) into the cards table,
  // then treat the cards table as the single source of truth — no primary card.
  // Skip entirely once migrated (the common case) — saves DB round trips per load.
  let ranCardMigration = false;
  if (!(profile.customization as { _migrated?: boolean } | null)?._migrated) {
    await ensureUserCards(user.id, profile as Record<string, unknown>);
    ranCardMigration = true;
  }

  // One-time: make every card's headshot explicit so none can inherit another
  // card's photo (oldest keeps the shared account photo, newer ones blank).
  if (!(profile.customization as { _photoMigrated?: boolean } | null)?._photoMigrated) {
    await backfillCardPhotos(adminDb, user.id, profile.customization as Record<string, unknown> | null, profile.photo_url as string | null);
    ranCardMigration = true;
  }

  // Only the (rare) migration paths above touch the cards table, so re-read then;
  // otherwise the parallel read is already current.
  const { data: cards } = ranCardMigration ? await cardsQuery() : cardsRes0;

  const allCards = cards ?? [];
  const hasCards = allCards.length > 0;

  // Active card: the explicitly-selected one. With exactly one card we auto-open it;
  // with 2+ cards and none selected (e.g. right after login) the user must pick one.
  const activeCard =
    allCards.find((c) => c.username === selectedCard) ?? (allCards.length === 1 ? allCards[0] : null);
  const activeSource = activeCard ?? profile;
  const activeUsername = (activeCard?.username ?? "") as string;
  const analyticsUsername = activeUsername;

  const isPro = isPaidPlan(profile.plan);
  const isEnterprise = profile.plan === "enterprise";
  const isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "");

  // Whether "Add card" is offered at all. Named once because the My Cards box
  // renders the control twice — an inline text link on desktop, a full-width
  // button on mobile — and the two must never disagree about who can add.
  const canAddCard = isPro || allCards.length < PLAN_LIMITS.FREE_CARD_LIMIT;

  // App-level Pro grant (14-day reverse trial or a stacked referral/free month):
  // plan is pro, with an expiry, and NO real Stripe subscription behind it.
  const proExpiresAt = profile.plan_expires_at as string | null;
  const onAppGrant = profile.plan === "pro" && !!proExpiresAt && !profile.stripe_subscription_id;
  const trialDaysLeft = onAppGrant ? daysUntil(proExpiresAt as string) : 0;
  const isTrialGrant = !!(profile.customization as { _trial?: boolean } | null)?._trial;

  // No cards yet → show the "create your card" empty state.
  if (!hasCards) {
    return (
      <>
        <AppStorePopup trigger={params.welcome === "1"} />
        {/* TourAutoStart was mounted ONLY in the has-cards branch below. But
            onboarding sends a brand-new account here with ?welcome=1 and that
            account has no cards yet — so it always landed on THIS branch, and
            no direct signup ever got the guided tour. The component's own
            comment claims that regression was already fixed; it wasn't, because
            the fix went to the other branch. */}
        <Suspense><TourAutoStart /></Suspense>
        {/* hasCards={false} is the whole point of persisting it HERE too.
            This branch renders none of the tour's anchors — no nav strip, no
            tab bar, no card/traffic/contacts panels — so every spotlighted step
            would poll ~2.9s for an element that cannot exist, ~30s of a tour
            that looks frozen, and then land on /share which redirects straight
            back here. Recording it lets buildTourSteps drop those steps up
            front. Written only from the branch that knows it: the has-cards
            branch below writes `true` and overwrites this the moment a card
            exists. */}
        <TourContextPersist
          tier={isEnterprise ? "office" : isPro ? "pro" : "free"}
          isOfficeMember={false}
          hasCards={false}
        />
        <div className="sc-top-stripe fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />
        <nav className="sc-app fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60">
          <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SwiftCardIcon size={28} />
              <span className="font-bold text-white text-sm tracking-tight">SwiftCard</span>
            </div>
            <SignOutButton />
          </div>
        </nav>
        {/* sc-still: in the native shell this screen is a fixed, non-scrolling
            surface (globals.css) — a static choice screen, not a document. */}
        <main className="sc-still sc-app min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/15 border border-blue-600/30 flex items-center justify-center mb-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={1.5} className="w-8 h-8">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path strokeLinecap="round" d="M3 9.5h18" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Let&apos;s create your first card</h1>
          <p className="text-gray-400 text-sm mb-8 max-w-sm">Your digital business card — add your info, socials, and design in about 60 seconds.</p>
          <Link href="/cards/new?add=1" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3.5 rounded-full text-sm transition-colors">
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
        <div className="sc-top-stripe fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />
        <nav className="sc-app fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60">
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
        {/* sc-still: the card picker must be a STILL screen in the shell — you
            look, you tap a card. It has no tab bar and fits the viewport, yet
            it scrolled (and rubber-banded) because the document could always
            move; globals.css pins it. Long card lists scroll INSIDE the fixed
            surface, the page itself never moves. */}
        <main className="sc-still sc-app min-h-screen bg-gray-950 flex flex-col items-center justify-center px-5 py-24">
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
                    <p className="text-gray-500 text-xs truncate">/{cardSlug(card.name || "", card.company) === card.username ? prettyCardSlug(card.name || "", card.company) : card.username}{card.name ? ` · ${card.name}` : ""}</p>
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

  // Traffic box: SwiftCard (card link) + SwiftLink (links page) views for the
  // chosen window (today / week / month).
  //
  // Views are stored in UTC, but the owner reads this dashboard on THEIR
  // calendar. Bucketing/windowing by UTC put an 11pm-Pacific view on the next
  // day and made "today" start at the wrong hour. We window by the owner's LOCAL
  // day using the tz the browser reported (sc_tz cookie); absent it (first
  // paint, cookies off), we fall back to UTC — same as the old behaviour, so no
  // regression. tzNow is a single "now" so every window below is consistent.
  const ownerTz = safeTimeZone((await cookies()).get("sc_tz")?.value);
  const tzNow = new Date();
  // Days-back that yields the required number of LOCAL day buckets, today
  // included: month → 30 buckets (today + 29 prior), week → 7, today → 1.
  const windowDaysBack = viewsRange === "month" ? 29 : viewsRange === "week" ? 6 : 0;
  const windowStartDate = startOfLocalDayUtc(windowDaysBack, ownerTz, tzNow);
  const windowStart = windowStartDate.getTime();
  const viewsCutoff = windowStartDate.toISOString();

  // ONE parallel batch for everything below-the-fold — previously 4 sequential
  // awaits (2 counts → best-day rows → locations → leads+notifications), i.e.
  // 3 extra DB round trips per dashboard load. Now a single round trip's latency.
  const [
    { count: swiftCardViews },
    { count: swiftLinkViews },
    { data: recentViews },
    locViewsRes,
    { data: leads },
    panelNotifRes,
    bellNotifRes,
    ownedOfficeRes,
    canViewOfficeAdminRes,
  ] = await Promise.all([
    // card_views is written by the PUBLIC view API via the service role and has
    // RLS on with no select policy — reading it with the user's session client
    // silently returns 0 rows (this hid ALL traffic). Read via the admin client;
    // safe: analyticsUsername is verified above to be one of THIS user's cards.
    getAdminSupabase().from("card_views").select("*", { count: "exact", head: true }).eq("username", analyticsUsername).gte("viewed_at", viewsCutoff),
    getAdminSupabase().from("card_views").select("*", { count: "exact", head: true }).eq("username", linkUsername).gte("viewed_at", viewsCutoff),
    // 60 days of raw view timestamps: powers the best-day stat (30d), the
    // Traffic bar graph buckets, and the window's unique/repeat split.
    // Paged: a single unbounded select is silently capped at the API's max-rows
    // (1000), which made the graph/unique-visitors contradict the exact head
    // counts above on busy cards. Newest-first, so if the cap below is ever hit
    // it's the OLDEST tail of the window that's dropped.
    (async () => {
      const PAGE = 1000, MAX_PAGES = 10;
      // visitor_id rides along so the window's unique-viewer / repeat-view
      // split can be computed from the same rows the graph is built from.
      const all: { viewed_at: string; username: string; visitor_id: string | null }[] = [];
      for (let p = 0; p < MAX_PAGES; p++) {
        const { data } = await getAdminSupabase()
          .from("card_views")
          .select("viewed_at, username, visitor_id")
          .in("username", [analyticsUsername, linkUsername])
          .gte("viewed_at", daysAgoISO(60))
          .order("viewed_at", { ascending: false })
          .range(p * PAGE, p * PAGE + PAGE - 1);
        if (!data?.length) break;
        all.push(...data);
        if (data.length < PAGE) break;
      }
      return { data: all };
    })(),
    // Paged like recentViews above: unpaged, this hit PostgREST's silent
    // 1000-row cap, so a busy card's "all time" top locations were computed
    // from an arbitrary 1000-row slice. Newest-first so if the page cap is
    // ever hit it's the oldest tail that drops.
    viewsRange === "locations"
      ? (async () => {
          const PAGE = 1000, MAX_PAGES = 10;
          const all: { username: string; location: string | null }[] = [];
          for (let p = 0; p < MAX_PAGES; p++) {
            const { data } = await getAdminSupabase()
              .from("card_views")
              .select("username, location")
              .in("username", [analyticsUsername, linkUsername])
              .not("location", "is", null)
              .order("viewed_at", { ascending: false })
              .range(p * PAGE, p * PAGE + PAGE - 1);
            if (!data?.length) break;
            all.push(...data);
            if (data.length < PAGE) break;
          }
          return { data: all };
        })()
      : Promise.resolve({ data: null }),
    // Service-role, like /contacts — NOT the session client. leads' RLS policy
    // keys on profiles.username, but a lead's card_owner is a CARD slug, and
    // those are different strings (profile "aaron-c69a77" vs card
    // "aaron-lavi-malve-capital"). So the session client matched zero rows and
    // this page rendered "Contacts 0" / "0 total leads", hid Export, and showed
    // the first-lead nudge — while /contacts, which already used service-role,
    // listed the same contacts correctly.
    //
    // Scoping is unchanged and still owner-bound: activeUsername comes from
    // allCards.find(...) above, i.e. it is ALWAYS one of this user's own card
    // slugs (or "" when nothing is selected), so this cannot read another
    // account's leads.
    getAdminSupabase()
      .from("leads")
      // Trimmed to columns this page actually renders (QuickContactList,
      // NotificationsPanel, and the isLocked/tags check) — message, location,
      // notes, status, source, follow_up_date were fetched but never used
      // here (performance audit).
      .select("id, name, email, phone, company, tags, created_at")
      .eq("card_owner", activeUsername)
      .order(
        sortBy === "name-asc" || sortBy === "name-desc" ? "name" : "created_at",
        { ascending: sortBy === "name-asc" || sortBy === "oldest" }
      ),
    // Panel (bottom of dashboard): ONLY this card's activity (+ account-level
    // ones like referral months, which have no card scope).
    // Unread first, then newest — matching /api/notifications. Ordering on
    // created_at alone let 20 recent read rows hide every older unread one
    // from both the list and the badge (the badge counts fetched rows).
    supabase.from("notifications").select("id, type, title, body, read, created_at, card_owner").eq("user_id", user.id).or(`card_owner.eq.${activeUsername.replace(/[^a-z0-9-]/gi, "")},card_owner.is.null`).order("read", { ascending: true }).order("created_at", { ascending: false }).limit(20),
    // Bell (top nav): EVERY card's notifications, each tagged with its card.
    supabase.from("notifications").select("id, type, title, body, read, created_at, card_owner").eq("user_id", user.id).order("read", { ascending: true }).order("created_at", { ascending: false }).limit(20),
    // Service-role client: the offices RLS policies are mutually recursive with
    // office_members, so a user-scoped read raises "infinite recursion detected
    // in policy for relation offices" once there's a row to evaluate. Still
    // scoped to this caller's own owner_id.
    isEnterprise
      ? getAdminSupabase().from("offices").select("id, name").eq("owner_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Office-admin nav visibility — previously a SERIAL await after the batch
    // (one extra DB round trip on every dashboard load). Runs alongside; the
    // ownedOffice short-circuit below still wins when it applies.
    canViewOfficeAdmin(user.id, profile.plan),
  ]);

  // If the notifications.card_owner column migration hasn't run yet, BOTH
  // scoped queries above error and the panel/bell would silently show nothing
  // (this exact failure hid real "shared their info" notifications). Fall back
  // to the un-scoped query so notifications always appear.
  type NotifRow = { id: string; type: string; title: string; body: string | null; read: boolean; created_at: string; card_owner?: string | null };
  let panelNotifications: NotifRow[] | null = panelNotifRes.data;
  let bellNotifications: NotifRow[] | null = bellNotifRes.data;
  if (panelNotifRes.error || bellNotifRes.error) {
    const { data: fallback } = await supabase
      .from("notifications")
      .select("id, type, title, body, read, created_at")
      .eq("user_id", user.id)
      .order("read", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(20);
    panelNotifications ??= fallback;
    bellNotifications ??= fallback;
  }

  // Basic-panel "best day" (last 30 LOCAL days) — available to every plan.
  // Keyed by the owner's local calendar day (not UTC) so a busy evening isn't
  // split across two dates. Cutoff is start of the local day 29 days ago.
  const thirtyDayCutoff = startOfLocalDayUtc(29, ownerTz, tzNow).toISOString();
  const dayTally: Record<string, number> = {};
  for (const v of recentViews ?? []) {
    if ((v.viewed_at as string) < thirtyDayCutoff) continue;
    const k = localDayKey(v.viewed_at as string, ownerTz);
    dayTally[k] = (dayTally[k] ?? 0) + 1;
  }
  let bestDay: { date: string; views: number } | null = null;
  for (const [date, views] of Object.entries(dayTally)) {
    if (!bestDay || views > bestDay.views) bestDay = { date, views };
  }

  // ── Traffic graph + trend ────────────────────────────────────────────────────
  // Bucket the selected window's views into bars (today → 24 hours, week → 7
  // days, month → 30 days), all in the owner's LOCAL calendar so a bar's label
  // matches the views inside it. Day buckets key off localDayKey; hour buckets
  // (today) index off local-midnight. Each bar carries the real instant of its
  // start (local midnight / local hour) so the chart axis reads correctly.
  const bucketCount = viewsRange === "month" ? 30 : viewsRange === "week" ? 7 : 24;
  const trafficBars: number[] = Array.from({ length: bucketCount }, () => 0);
  // Ordered day keys for the day views, oldest→newest, so a view maps to its bar.
  const dayBarKeys =
    viewsRange === "today"
      ? []
      : Array.from({ length: bucketCount }, (_, i) =>
          localDayKey(startOfLocalDayUtc(bucketCount - 1 - i, ownerTz, tzNow), ownerTz),
        );
  const dayBarIndex = new Map(dayBarKeys.map((k, i) => [k, i]));
  for (const v of recentViews ?? []) {
    const iso = v.viewed_at as string;
    const t = new Date(iso).getTime();
    if (t < windowStart) continue; // previous-window rows are counted via exact queries
    if (viewsRange === "today") {
      const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((t - windowStart) / 36e5)));
      trafficBars[idx]++;
    } else {
      const idx = dayBarIndex.get(localDayKey(iso, ownerTz));
      if (idx != null) trafficBars[idx]++;
    }
  }
  // % vs the previous window; null when there's no baseline to compare against.

  // Unique viewers vs repeat views for the selected window, from the same rows
  // the graph buckets. A viewer is their visitor_id; a row with none (storage-
  // blocked browser) counts as its own viewer — never claimed as a repeat we
  // can't prove. Repeat = total − unique: every additional visit by a known
  // returning viewer.
  const windowIds = new Map<string, number>();
  let windowNullIdRows = 0;
  let windowTotalRows = 0;
  for (const v of recentViews ?? []) {
    if (new Date(v.viewed_at as string).getTime() < windowStart) continue;
    windowTotalRows++;
    const vid = (v as { visitor_id?: string | null }).visitor_id;
    if (vid) windowIds.set(vid, (windowIds.get(vid) ?? 0) + 1);
    else windowNullIdRows++;
  }
  const uniqueViewers = windowIds.size + windowNullIdRows;
  const repeatViews = Math.max(0, windowTotalRows - uniqueViewers);
  const maxBar = Math.max(1, ...trafficBars);
  // Timeline for the chart: each bar's real start instant (local hour / local
  // midnight) so the axis labels line up with the buckets above.
  const trafficBuckets = trafficBars.map((count, i) => ({
    count,
    ts:
      viewsRange === "today"
        ? windowStart + i * 36e5
        : startOfLocalDayUtc(bucketCount - 1 - i, ownerTz, tzNow).getTime(),
  }));

  // Locations view (on-demand): top places your card + links are viewed from,
  // with the SwiftCard vs Swift Links split per location. All-time totals.
  let topLocations: { location: string; card: number; link: number; total: number }[] = [];
  if (viewsRange === "locations") {
    const locMap: Record<string, { card: number; link: number }> = {};
    for (const v of (locViewsRes.data ?? []) as { username: string; location: string | null }[]) {
      const loc = v.location?.trim();
      if (!loc) continue;
      const slot = (locMap[loc] ??= { card: 0, link: 0 });
      if (v.username === linkUsername) slot.link++; else slot.card++;
    }
    topLocations = Object.entries(locMap)
      .map(([location, c]) => ({ location, card: c.card, link: c.link, total: c.card + c.link }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }

  const allLeads = leads ?? [];
  // Free plan: leads captured beyond the 5/month cap are tagged locked. The owner
  // sees only unlocked leads; the locked ones are counted for the upgrade banner
  // and hidden until they go Pro (upgrading makes isPro true → nothing hidden).
  const isLocked = (l: { tags?: string[] | null }) => Array.isArray(l.tags) && l.tags.includes(LOCKED_LEAD_TAG);
  const visibleLeads = isPro ? allLeads : allLeads.filter((l) => !isLocked(l));
  const lockedCount = isPro ? 0 : allLeads.length - visibleLeads.length;
  const monthlyLeadsUsed = readUsage(profile.customization).leads;


  const atLimit = !isPro && monthlyLeadsUsed >= FREE_LIMIT;
  const nearLimit = !isPro && monthlyLeadsUsed >= FREE_LIMIT - 2;

  const ownedOffice = ownedOfficeRes.data;

  // Who sees the "Admin" nav item (the team console at /office/admin) — mirrors
  // that page's own access rule so the link never lands on a redirect. This is
  // the OFFICE admin; the site-owner console at /admin is separate and gated by
  // ADMIN_EMAILS (`isAdmin` below).
  const canSeeOfficeAdmin = ownedOffice ? true : canViewOfficeAdminRes;

  // Plan/role for the guided tour, derived from data already loaded (no extra
  // queries). Office members are plan="enterprise" WITH an office_id but no
  // owned office; owners have an owned office (or are an enterprise owner-to-be
  // who hasn't created one yet, so has no office_id).
  const tourTier: "free" | "pro" | "office" = isEnterprise ? "office" : isPro ? "pro" : "free";
  const isOfficeMember = isEnterprise && !ownedOffice && !!profile.office_id;

  const cardUrl = `${APP_URL}/${activeUsername}`;

  // Bell tags: username → human label, so every notification shows which card
  // it came from ("Work", "Personal", …) instead of a raw slug.
  const cardLabels: Record<string, string> = Object.fromEntries(
    allCards.map((c) => [c.username as string, (c.label || c.name || c.username) as string])
  );

  // The SAME builder the public card page and the signature use. This one used
  // to omit `snapchat` entirely, so a card that showed a Snapchat handle
  // publicly lost it here — and in the share images and signature captured from
  // this very object.
  // The builder also plan-gates the template — the custom designer is Pro-only,
  // so a downgraded card renders the standard one. Taking it from the same
  // place as the data is what stops the preview and the card disagreeing about
  // which template they are.
  const { data: cardData, template: activeTemplate } = buildCardData(activeSource, {
    appUrl: APP_URL,
    isPro,
    accountPhotoUrl: profile.photo_url,
  });

  // Apple Wallet is only offered once the Apple pass certificate is configured.
  const walletEnabled = hasWalletConfig();

  // Your Card + Share + other ways to share — rendered under My Cards on mobile,
  // and in the sticky right column on desktop.
  // CardCaptureProvider lets the Share box offer a PNG of the card that lives
  // in the Your Card box. It wraps the PANEL, not the page, on purpose: this
  // whole fragment renders TWICE (lg:hidden under My Cards, hidden lg:flex in
  // the right column) and both copies are always in the DOM with one
  // display:none. A single page-level provider would let whichever card
  // registered last win, and rasterizing a display:none node yields a blank
  // PNG. Per-copy providers mean a modal always captures the card beside it.
  const cardSharePanel = (
    <CardCaptureProvider>
      {/* Your card */}
      <div data-tour="your-card" className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
        {/* Editing lives in Settings → Cards and sharing, and only there. This
            header used to carry an Edit link; the dashboard is now for viewing
            and sharing a card, not changing it. */}
        {/* mb-3 on mobile takes over the spacing the caption's own mb-3 gave
            it, so hiding the caption tightens the box without collaring the
            preview against the heading. */}
        <div className="flex items-center justify-between mb-3 lg:mb-1">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Your Card</p>
        </div>
        {/* Desktop-only: on a phone the preview directly below says this by
            being the card, and the screen is too short to spend a line on it.
            lg:, matching this PANEL's own breakpoint — it is the width at which
            the whole thing moves from under My Cards to the sticky right column,
            and the control under the card flips there too. At sm: a 768px tablet
            got the desktop caption sitting above the mobile QR button. */}
        <p className="hidden lg:block text-gray-600 text-[11px] mb-3 leading-relaxed">Exactly what people get when you share.</p>
        {/* previewUrl powers the NATIVE path ONLY: in the iOS shell WKWebView
            can't save a generated PNG data URL, so DownloadCardButton shares
            this link via the native share sheet instead of dead-tapping.
            It renders no visible control — opening the card is the job of the
            "View live" button in the My Cards box, and this prop briefly
            resurrected a duplicate "Preview" link that had been deliberately
            removed. */}
        <CardPreviewDownload
          data={cardData}
          template={activeTemplate}
          username={activeUsername}
          previewUrl={cardUrl}
        />
      </div>

      {/* Share */}
      <div data-tour="share" className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5 space-y-2">
        <ShareButton
          url={cardUrl}
          title="My SwiftCard"
          text="Save my contact and connect with me instantly."
          label="Share"
        />
        <MoreShareOptions url={cardUrl} walletUsername={walletEnabled ? activeUsername : undefined} />
      </div>
    </CardCaptureProvider>
  );

  return (
    <>
      <AppStorePopup trigger={params.welcome === "1"} />
      {/* IAP preflight probe — dedicated test account only, renders nothing.
          See components/IapProbe.tsx for why the purchase chain is verified
          this way rather than by driving the simulator UI. */}
      {user.email?.toLowerCase() === "iap-test@swiftcard.me" && <IapProbe />}
      {/* Auto-start the guided tour for a new account arriving from onboarding
          (?tour=1). No-ops if the tour was already taken. */}
      <Suspense><TourAutoStart /></Suspense>
      {/* Reports the viewer's timezone (sc_tz cookie) so analytics bucket by the
          owner's local day. Safe no-op progressive enhancement. */}
      <TimezoneCookie />
      {/* Backstop for the guest-signup flow: claims a still-pending localStorage
          draft ONLY on an explicit post-auth claim return (?claim=1). Never on a
          bare dashboard visit — otherwise logging into an existing account would
          silently swallow a leftover guest draft into it (the "bleed" bug). The
          real claim already happens on /cards/new?claim=1 in every auth path. */}
      {params.claim === "1" && <GuestDraftClaim />}
      <Suspense>
        <CardSelectionPersist selectedCard={selectedCard} />
      </Suspense>
      {/* Persist plan/role so the guided tour describes the right plan. */}
      <TourContextPersist tier={tourTier} isOfficeMember={isOfficeMember} hasCards />

      {/* Top accent stripe */}
      <div className="sc-top-stripe fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />

      {/* Sticky navbar */}
      <nav className="sc-app fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link href={`/dashboard?card=${activeUsername}`} className="flex items-center gap-2">
              <SwiftCardIcon size={28} />
              <span className="font-bold text-white text-sm tracking-tight hidden sm:block">SwiftCard</span>
            </Link>
            {isEnterprise ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white">Office</span>
            ) : (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPro ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
                {isPro ? "Pro" : "Free"}
              </span>
            )}
          </div>

          <div className="hidden md:flex items-center gap-0.5">
            {[
              { href: `/dashboard?card=${activeUsername}`, label: "Dashboard", active: true },
              { href: `/contacts?card=${activeUsername}`, label: "Contacts", active: false },
              { href: `/share?card=${activeUsername}`, label: "Links", active: false },
            ].map(({ href, label, active }) => (
              <Link key={href} href={href} data-tour={`nav-${label.toLowerCase()}`}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${active ? "text-white font-medium bg-gray-800" : "text-gray-400 hover:text-white hover:bg-gray-800/60"}`}>
                {label}
              </Link>
            ))}
            {canSeeOfficeAdmin && (
              <Link href="/office/admin" data-tour="nav-admin" className="text-sm text-purple-400 hover:text-purple-300 hover:bg-gray-800/60 px-3 py-1.5 rounded-lg transition-colors font-medium">
                Admin
              </Link>
            )}
            {/* Site-owner console — a different thing entirely from the Office
                "Admin" above, so it's labelled separately to keep them apart. */}
            {isAdmin && (
              <Link href="/admin" className="text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-800/60 px-3 py-1.5 rounded-lg transition-colors font-medium">
                Site
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile already has Settings in the bottom tab bar (MobileNav) —
                same /settings/flows destination — so this top-bar gear is
                redundant clutter on small screens; keep it for desktop, which
                has no bottom tab bar. */}
            <span data-tour="nav-settings" className="hidden md:flex items-center"><SettingsLinkButton /></span>
            <span data-tour="nav-grow" className="flex items-center"><GrowLinkButton /></span>
            <span data-tour="theme" className="flex items-center"><ThemeToggle /></span>
            <span data-tour="notif-bell" className="flex items-center"><NotificationBell initialNotifications={bellNotifications ?? []} cardLabels={cardLabels} activeCard={activeUsername} /></span>
            <div className="w-px h-4 bg-gray-800 mx-1 hidden sm:block" />
            <SignOutButton />
          </div>
        </div>
      </nav>

      <MobileNavGate showAdmin={canSeeOfficeAdmin} />
      <HelpWidget floating />
      {/* pb-36 on mobile (was pb-24): the floating help bubble is fixed at
          bottom-20 and is 52px tall, so it covers the band 80px–132px up from
          the bottom of the viewport. pb-24 ended the content at 96px — inside
          that band — so the bubble sat on top of the last card's buttons and
          swallowed taps meant for them. Desktop is unchanged (md:pb-12): there
          the bubble is at bottom-5, clear of the content. Adds trailing scroll
          space on phones only; no element changes size or position. */}
      <main className="sc-app min-h-screen bg-gray-950 pt-20 pb-36 md:pb-12">
        <div className="max-w-5xl mx-auto px-5">

          {/* Reverse-trial / free-Pro countdown */}
          {onAppGrant && trialDaysLeft > 0 && <TrialBanner daysLeft={trialDaysLeft} isTrial={isTrialGrant} />}

          {/* First-run guided-tour invitation */}
          <TourBanner />

          {/* My Cards — full width, top of dashboard */}
          <div data-tour="my-cards" className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5 mb-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm">My Cards</p>
                {/* Desktop-only: the rows below are checkboxes and behave like
                    checkboxes, and on a phone this ran to two lines directly
                    under the title — the tallest thing in the box explaining
                    the most obvious thing in it. */}
                <p className="hidden sm:block text-gray-600 text-xs mt-0.5">Check a card to view everything about it. Only one card can be selected at a time.</p>
              </div>
              {/* Card actions, top-right of the box.

                  "View live" moved here from a page header that has been
                  removed: it belongs beside the card list it acts on rather
                  than floating above the page. It is sized to match "Add card"
                  exactly so the two read as one control group, and coloured
                  neutral against Add card's blue so the primary action still
                  leads.

                  Both pills are a hair larger from sm up — a mouse target
                  doesn't need to be thumb-sized but shouldn't look shrunken.

                  shrink-0 on the wrapper AND on each pill. The wrapper stops a
                  long card title squeezing the pair (the title truncates
                  instead — min-w-0 above is what allows that); the per-pill
                  shrink-0 stops the two squeezing EACH OTHER, which a
                  non-shrinking wrapper does not prevent on its own. */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={cardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open your live card in a new tab"
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-gray-700 text-gray-300 text-[11px] sm:text-xs font-semibold hover:border-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  View live
                </a>
                {canAddCard && (
                  <Link
                    href="/cards/new?add=1"
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-gray-700 text-blue-400 text-[11px] sm:text-xs font-semibold hover:border-blue-600/60 hover:text-blue-300 hover:bg-blue-600/5 transition-colors"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true">
                      <path d="M10 4a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 0110 4z" />
                    </svg>
                    Add card
                  </Link>
                )}
              </div>
            </div>
            {/* The rows moved into a client component so mobile can collapse to
                just the selected card with a chevron to reveal the rest.
                Desktop is unchanged. The Free-plan upsell below is handed over
                as a SLOT rather than rebuilt there, so its condition and markup
                stay here, in one place, and it is rendered outside anything the
                dropdown can hide. */}
            <MyCardsList
              cards={allCards.map((c) => ({
                id: c.id as string,
                username: c.username as string,
                label: (c.label as string | null) ?? null,
                name: (c.name as string | null) ?? null,
              }))}
              activeUsername={activeUsername}
              isPro={isPro}
              freeCardLimit={PLAN_LIMITS.FREE_CARD_LIMIT}
              view={view}
              sortBy={sortBy}
              upsell={
                !isPro && allCards.length >= PLAN_LIMITS.FREE_CARD_LIMIT ? (
                <PlanGate
                  feature="second-card"
                  nativeCopy="Pro feature — Multiple cards are only available on the Pro plan on swiftcard.me"
                >
                  <Link
                    href="/upgrade"
                    className="group flex items-center justify-between border border-dashed border-gray-800 hover:border-blue-600/60 rounded-xl px-4 py-3 flex-1 min-w-full sm:min-w-[200px] transition-colors"
                  >
                    <p className="text-gray-400 group-hover:text-gray-200 text-xs transition-colors">Ready for a second card? Go unlimited with Pro.</p>
                    <span className="text-xs text-blue-400 group-hover:text-blue-300 font-medium shrink-0 ml-2">Upgrade to Pro →</span>
                  </Link>
                </PlanGate>
                ) : null
              }
            />
          </div>

          {/* Mobile only: Your Card + Share + other ways to share, right under My Cards */}
          <div className="flex flex-col gap-4 mb-5 lg:hidden">
            {cardSharePanel}
          </div>

          {/* Upgrade success banner. /checkout/success only ever redirects, so
              this is the first render after a completed Pro purchase — and
              therefore the only place we can observe it client-side. */}
          {params.upgraded && <TrackEvent event="checkout_completed" props={{ plan: "pro" }} />}
          {params.upgraded && (
            <div className="flex items-center gap-3 bg-green-950 border border-green-800/60 rounded-2xl px-5 py-3.5 mb-5">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 20 20" fill="#4ade80" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/></svg>
              </div>
              <p className="text-green-400 text-sm font-medium">Welcome to Pro! Your plan is now active.</p>
            </div>
          )}

          {/* Free plan limit banner */}
          <FirstLeadNudge leadCount={visibleLeads.length} isPro={isPro} />

          {!isPro && (nearLimit || lockedCount > 0) && (
            <PlanGate
              feature="leads-cap"
              nativeCopy={
                lockedCount > 0
                  ? `Pro feature — ${lockedCount} new leads are locked this month. Unlimited leads are only available on the Pro plan on swiftcard.me`
                  : "Pro feature — You've used your 5 free leads this month. Unlimited leads are only available on the Pro plan on swiftcard.me"
              }
              // Native: show only the neutral notice for the cap/locked states
              // (no UpgradeButton, no referral promo — both are selling). When
              // it's just the usage counter (near-limit but not at-limit / not
              // locked), keep it as a pure fact with no selling attached.
              nativeContent={
                lockedCount > 0 || atLimit ? (
                  <div className="mb-5">
                    <PlanNotice
                      tier="pro"
                      copy={
                        lockedCount > 0
                          ? `Pro feature — ${lockedCount} new leads are locked this month. Unlimited leads are only available on the Pro plan on swiftcard.me`
                          : "Pro feature — You've used your 5 free leads this month. Unlimited leads are only available on the Pro plan on swiftcard.me"
                      }
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl px-5 py-3.5 mb-5 bg-amber-950/40 border border-amber-800/40">
                    <p className="text-sm font-medium text-amber-400">{monthlyLeadsUsed}/{FREE_LIMIT} free leads used this month</p>
                  </div>
                )
              }
            >
              <div className="rounded-2xl px-5 py-3.5 mb-5 bg-amber-950/40 border border-amber-800/40">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <p className="text-sm font-medium text-amber-400">
                      {lockedCount > 0
                        ? `${lockedCount} new lead${lockedCount === 1 ? " is" : "s are"} locked this month. Upgrade to Pro to unlock ${lockedCount === 1 ? "it" : "them"} — and never miss the next one.`
                        : atLimit
                          ? `You've used your ${FREE_LIMIT} free leads this month. Upgrade to Pro for unlimited.`
                          : `${monthlyLeadsUsed}/${FREE_LIMIT} free leads used this month`}
                    </p>
                  </div>
                  <UpgradeButton />
                </div>
                <p className="text-amber-200/60 text-xs mt-2">
                  Not ready to upgrade? <strong className="text-amber-200">Invite 3 friends</strong> — when they sign up, you get a month of Pro free (up to 3 months).
                </p>
              </div>
            </PlanGate>
          )}

          {/* Traffic — SwiftCard & SwiftLink views (full width; Swift Links + Email signature moved to /share) */}
          <div data-tour="traffic" className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-semibold text-sm">Traffic</p>
                <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
                  {([
                    { id: "today", label: "Today" },
                    { id: "week", label: "Week" },
                    { id: "month", label: "Month" },
                    { id: "locations", label: "Locations" },
                  ] as const).map((r) => (
                    <Link key={r.id} scroll={false} href={`?vrange=${r.id}&view=${view}&sort=${sortBy}${selectedCard ? `&card=${selectedCard}` : ""}`}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors inline-flex items-center gap-1 ${viewsRange === r.id ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                      {r.label}
                      {r.id === "locations" && !isPro && (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 opacity-70"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" /></svg>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
              {viewsRange === "locations" ? (
                !isPro ? (
                  <PlanGate
                    feature="analytics-locations"
                    nativeCopy="Pro feature — Detailed analytics are only available on the Pro plan on swiftcard.me"
                  >
                    <div className="bg-gray-800/40 border border-gray-800 rounded-xl px-4 py-6 text-center">
                      <div className="w-10 h-10 rounded-full bg-blue-600/15 border border-blue-500/30 flex items-center justify-center mx-auto mb-3">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={1.8} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                      </div>
                      <p className="text-white text-sm font-semibold">See where your views come from</p>
                      <p className="text-gray-500 text-xs mt-1 mb-4 leading-relaxed max-w-[280px] mx-auto">Top locations are part of full analytics on Pro — see which cities are opening your card and links.</p>
                      <Link href="/upgrade" className="inline-block text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-full transition-colors">Upgrade to Pro →</Link>
                    </div>
                  </PlanGate>
                ) : topLocations.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-gray-500 text-[11px] mb-1">Top locations · all time</p>
                    {topLocations.map((loc) => (
                      <div key={loc.location} className="bg-gray-800/40 border border-gray-800 rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-gray-100 text-sm font-semibold truncate">{loc.location}</p>
                          <p className="text-white text-sm font-bold tabular-nums shrink-0">{loc.total} <span className="text-gray-500 font-medium text-[11px]">views</span></p>
                        </div>
                        <div className="flex items-center gap-4 text-[11px]">
                          <span className="text-gray-500">SwiftCard <span className="text-gray-200 font-semibold tabular-nums">{loc.card}</span></span>
                          <span className="text-gray-500">Swift Links <span className="text-gray-200 font-semibold tabular-nums">{loc.link}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-800/40 border border-gray-800 rounded-xl px-4 py-6 text-center">
                    <p className="text-gray-400 text-sm">No location data yet</p>
                    <p className="text-gray-600 text-[11px] mt-1">Cities appear here as people view your card and links.</p>
                  </div>
                )
              ) : (
                <div>
                  {/* Stat tiles — side by side. The per-tile "▲ 23% this week"
                      trend line was removed at the owner's request; the counts
                      themselves are unchanged, and so is everything below. */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "SwiftCard views", value: swiftCardViews ?? 0 },
                      { label: "Swift Link views", value: swiftLinkViews ?? 0 },
                    ].map((m) => (
                      <div key={m.label} className="bg-gray-800/40 border border-gray-800 rounded-xl px-4 py-3.5 min-w-0">
                        <p className="text-gray-400 text-xs font-medium truncate">{m.label}</p>
                        <p className="text-2xl font-bold text-white tabular-nums mt-0.5">{m.value.toLocaleString("en-US")}</p>
                      </div>
                    ))}
                  </div>

                  {/* Unique vs repeat for the same window — the split that
                      tells an owner "5 people, and two of them came back",
                      which raw totals can't. Only shown once there's data. */}
                  {windowTotalRows > 0 && (
                    <div className="flex items-center gap-4 mt-2 text-[11px]">
                      <span className="text-gray-500">Unique viewers <span className="text-gray-200 font-semibold tabular-nums">{uniqueViewers.toLocaleString("en-US")}</span></span>
                      <span className="text-gray-500">Repeat views <span className="text-gray-200 font-semibold tabular-nums">{repeatViews.toLocaleString("en-US")}</span></span>
                    </div>
                  )}

                  {/* Time-series bar graph — one bar per hour (Today) or day
                      (Week/Month), with a labeled time axis, baseline, and hover
                      tooltips. Newest bucket highlighted. */}
                  <TrafficChart
                    buckets={trafficBuckets}
                    range={viewsRange as "today" | "week" | "month"}
                    max={maxBar}
                    tz={ownerTz}
                  />
                </div>
              )}
              {/* Basic stats (every plan): contacts captured + best day */}
              <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-800/70 text-[11px]">
                <span className="text-gray-500">Contacts <span className="text-gray-200 font-semibold tabular-nums">{visibleLeads.length}</span></span>
                {bestDay && bestDay.views > 0 ? (
                  <span className="text-gray-500">Best day <span className="text-gray-200 font-semibold">{new Date(bestDay.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> · {bestDay.views}</span>
                ) : (
                  <span className="text-gray-600">No views yet</span>
                )}
              </div>
            </div>

          {/* Captures a pixel-perfect image of THIS card for its share-link
              preview (Open Graph). Invisible; regenerates when the card changes. */}
          <ShareCardCapture
            key={`share-${activeUsername}`}
            cardData={cardData}
            template={activeTemplate}
            username={activeUsername}
          />

          {/* Main: contacts + card panel */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-5 order-2 lg:order-none">

              {/* Contacts section */}
              <div data-tour="quick-contacts">
                {/* Header */}
                {/* flex-wrap, not a squashed single row. On a 375px phone with
                    leads (so Export renders too) five items shared one line and
                    every one of them broke mid-phrase: "Quick / Contacts",
                    "Total / leads", and "Add / contact" wrapping INSIDE the blue
                    button, which is what made it look twice its size. Wrapping
                    the ROW instead gives two clean lines; nothing inside a
                    control wraps. Desktop has the room, so it never wraps and is
                    unchanged. */}
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
                  {/* Just the title. The count + "Total leads" label used to sit
                      beside it and were removed on the owner's call (2026-08-11):
                      the number duplicates what the list below already shows. */}
                  <h2 className="text-white font-semibold text-sm whitespace-nowrap">Quick Contacts</h2>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isPro && (
                      <p className="text-gray-600 text-xs hidden sm:block">{monthlyLeadsUsed}/{FREE_LIMIT} this month</p>
                    )}
                    <span data-tour="add-contact" className="flex items-center"><AddContactModal cardOwner={activeUsername} /></span>
                  </div>
                </div>

                {/* View toggle — Notifications / Contacts. Filtering, the pipeline,
                    and status management live on the full Contacts page. */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div data-tour="contact-views" className="flex items-center bg-gray-800/80 rounded-lg p-0.5">
                    {[
                      { id: "notifications", label: "Notifications" },
                      { id: "list", label: "Contacts" },
                    ].map((v) => (
                      <Link key={v.id} scroll={false} href={`?view=${v.id}&sort=${sortBy}${selectedCard ? `&card=${selectedCard}` : ""}`}
                        className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${view === v.id ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                        {v.label}
                      </Link>
                    ))}
                  </div>
                  <Link href={`/contacts${selectedCard ? `?card=${selectedCard}` : ""}`} className="ml-auto text-xs text-gray-500 hover:text-white transition-colors">
                    View all in Contacts →
                  </Link>
                </div>

                {/* Lead list */}
                {view === "notifications" ? (
                  <NotificationsPanel
                    initial={(panelNotifications ?? []) as unknown as Parameters<typeof NotificationsPanel>[0]["initial"]}
                    card={activeUsername}
                    leads={visibleLeads.map((l) => ({ id: l.id as string, name: (l.name as string) || "" }))}
                  />
                ) : visibleLeads.length === 0 ? (
                  <div className="border border-dashed border-gray-800 rounded-2xl p-8">
                    <div className="text-center mb-6">
                      <div className="w-10 h-10 bg-gray-800/60 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-gray-600">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                        </svg>
                      </div>
                      <p className="font-semibold text-gray-300 text-sm mb-1">Share your card to get your first contact</p>
                      <p className="text-gray-600 text-xs mb-5">Send your link, show your QR code, or tap your NFC card — contacts appear here instantly.</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5">
                        <svg viewBox="0 0 16 16" fill="#3b82f6" className="w-3.5 h-3.5 shrink-0"><path d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8S12.42 0 8 0zm1 11.93V13H7v-1.07A6.003 6.003 0 012.07 7H4v-.5h-.93A6.003 6.003 0 017 1.07V2h2v1.07A6.003 6.003 0 0113.93 6.5H12V7h1.93A6.003 6.003 0 019 11.93z"/></svg>
                        <span className="text-blue-400 text-xs truncate flex-1">{cardUrl.replace("https://", "")}</span>
                        <CopyButton text={cardUrl} />
                      </div>
                      {/* The headline says SHARE; this button used to say
                          "Preview your card" and open the owner's own card in a
                          tab — an action that cannot possibly produce the contact
                          the copy just promised. The instruction and the only
                          solid button now agree. */}
                      <ShareButton
                        url={cardUrl}
                        text="Here's my card — save my details in one tap."
                        label="Share your card"
                      />
                      <a
                        href={cardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-gray-500 hover:text-gray-300 text-[11px] py-1 transition-colors"
                      >
                        See how it looks to them ↗
                      </a>
                    </div>
                  </div>
                ) : (
                  <QuickContactList
                    leads={visibleLeads.map((l) => ({
                      id: l.id as string,
                      name: (l.name as string) || "Contact",
                      email: (l.email as string) ?? "",
                      phone: (l.phone as string | null) ?? null,
                      company: (l.company as string | null) ?? null,
                      created_at: l.created_at as string,
                    }))}
                    card={activeUsername}
                  />
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN — card panel (desktop; on mobile it's shown under My Cards) ── */}
            <div className="hidden lg:flex lg:flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
              {cardSharePanel}
            </div>

          </div>
        </div>
      </main>
    </>
  );
}
