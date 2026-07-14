import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOfficeAnalytics, type EmployeeAnalytics } from "@/lib/office-analytics";

// ── Team-tab data: monthly stats, per-person activity, setup progress ───────
// Everything the Team tab shows beyond what getOfficeAnalytics already counts.
// Scoped to ONE office; callers must have passed requireOfficeAdmin first.
//
// "This month" is the CALENDAR month (what a small-business owner means by it),
// compared against the previous calendar month.

export type MonthStat = {
  current: number;
  previous: number;
  // null when last month was zero — "+100% from nothing" is a made-up number.
  deltaPct: number | null;
};

export type TeamPerson = EmployeeAnalytics & {
  // Latest card view or captured lead on any of their cards. Null = never.
  lastActiveAt: string | null;
};

export type TeamOverview = {
  stats: {
    leadsThisMonth: MonthStat;
    viewsThisMonth: MonthStat;
    activeMembers: MonthStat; // people with any card activity in the month
  };
  people: TeamPerson[];
  totals: { members: number; cards: number; views: number; leads: number };
};

function monthStartIso(offset: 0 | 1, now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  return d.toISOString();
}

function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// All public slugs a set of users own (profile handle + every card), keyed per
// user — the same union every other office query uses, built once.
async function slugsByUser(userIds: string[]): Promise<Map<string, string[]>> {
  const admin = getAdminSupabase();
  const map = new Map<string, string[]>();
  if (!userIds.length) return map;
  const [{ data: profiles }, { data: cards }] = await Promise.all([
    admin.from("profiles").select("id, username").in("id", userIds),
    admin.from("cards").select("user_id, username").in("user_id", userIds),
  ]);
  for (const p of profiles ?? []) {
    if (p.username) map.set(p.id as string, [p.username as string]);
  }
  for (const c of cards ?? []) {
    const arr = map.get(c.user_id as string) ?? [];
    if (c.username && !arr.includes(c.username as string)) arr.push(c.username as string);
    map.set(c.user_id as string, arr);
  }
  return map;
}

const viewKeys = (slugs: string[]) => slugs.flatMap((s) => [s, `${s}__links`]);

export async function getTeamOverview(officeId: string, ownerId: string): Promise<TeamOverview> {
  const admin = getAdminSupabase();
  const analytics = await getOfficeAnalytics(officeId, ownerId);

  const userIds = analytics.employees.map((e) => e.userId);
  const perUserSlugs = await slugsByUser(userIds);
  const allSlugs = Array.from(new Set(userIds.flatMap((id) => perUserSlugs.get(id) ?? [])));

  const now = new Date();
  const thisMonth = monthStartIso(0, now);
  const lastMonth = monthStartIso(1, now);

  // Month counts: four cheap head-count queries instead of pulling rows.
  const countViews = async (from: string, to?: string) => {
    if (!allSlugs.length) return 0;
    let q = admin.from("card_views").select("*", { count: "exact", head: true })
      .in("username", viewKeys(allSlugs)).gte("viewed_at", from);
    if (to) q = q.lt("viewed_at", to);
    const { count } = await q;
    return count ?? 0;
  };
  const countLeads = async (from: string, to?: string) => {
    if (!allSlugs.length) return 0;
    let q = admin.from("leads").select("*", { count: "exact", head: true })
      .in("card_owner", allSlugs).gte("created_at", from);
    if (to) q = q.lt("created_at", to);
    const { count } = await q;
    return count ?? 0;
  };

  // Per-person latest activity: newest view + newest lead on their slugs. Two
  // tiny (limit 1) queries per person, all in parallel — team size is bounded by
  // purchased seats, so this stays small.
  const lastActive = async (uid: string): Promise<string | null> => {
    const slugs = perUserSlugs.get(uid) ?? [];
    if (!slugs.length) return null;
    const [v, l] = await Promise.all([
      admin.from("card_views").select("viewed_at").in("username", viewKeys(slugs))
        .order("viewed_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("leads").select("created_at").in("card_owner", slugs)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const times = [v.data?.viewed_at, l.data?.created_at].filter(Boolean) as string[];
    if (!times.length) return null;
    return times.sort().at(-1) ?? null;
  };

  const [viewsCur, viewsPrev, leadsCur, leadsPrev, ...lastActives] = await Promise.all([
    countViews(thisMonth),
    countViews(lastMonth, thisMonth),
    countLeads(thisMonth),
    countLeads(lastMonth, thisMonth),
    ...userIds.map((id) => lastActive(id)),
  ]);

  const people: TeamPerson[] = analytics.employees.map((e, i) => ({
    ...e,
    lastActiveAt: lastActives[i] ?? null,
  }));
  // The owner-first pin made sense on the old Overview; the Team table sorts by
  // results instead — highest leads first, views as the tiebreak.
  people.sort((a, b) => b.leads - a.leads || b.views - a.views);

  const activeIn = (fromIso: string, toIso?: string) =>
    people.filter((p) => {
      if (!p.lastActiveAt) return false;
      if (p.lastActiveAt < fromIso) return false;
      if (toIso && p.lastActiveAt >= toIso) return false;
      return true;
    }).length;

  return {
    stats: {
      leadsThisMonth: { current: leadsCur, previous: leadsPrev, deltaPct: deltaPct(leadsCur, leadsPrev) },
      viewsThisMonth: { current: viewsCur, previous: viewsPrev, deltaPct: deltaPct(viewsCur, viewsPrev) },
      // "previous" here undercounts (lastActiveAt only remembers the newest
      // event, so someone active in BOTH months counts once, in this month) —
      // acceptable for a directional arrow, never shown as a raw count.
      activeMembers: {
        current: activeIn(thisMonth),
        previous: activeIn(lastMonth, thisMonth),
        deltaPct: null, // direction from a known-undercounted baseline would mislead
      },
    },
    people,
    totals: analytics.totals,
  };
}

// ── First-time setup checklist ───────────────────────────────────────────────
// Derived from durable facts rather than a stored flag: once branding exists,
// someone has been invited, and a first lead has arrived, all three read true
// and the checklist never renders again.

export type SetupProgress = {
  brandingDone: boolean;
  invitedDone: boolean;
  firstLeadDone: boolean;
  allDone: boolean;
};

export function computeSetupProgress(input: {
  hasBrand: boolean;
  memberRowCount: number; // any status — an invite that was sent counts, even if later revoked
  leadCount: number;
}): SetupProgress {
  const brandingDone = input.hasBrand;
  const invitedDone = input.memberRowCount > 0;
  const firstLeadDone = input.leadCount > 0;
  return { brandingDone, invitedDone, firstLeadDone, allDone: brandingDone && invitedDone && firstLeadDone };
}
