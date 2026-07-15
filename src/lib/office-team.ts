import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOfficeAnalytics, type EmployeeAnalytics } from "@/lib/office-analytics";
import { getOfficeSeatUsage, type SeatUsage } from "@/lib/office-seats";
import { isInviteExpired } from "@/lib/office-invite";

// ── Team-tab data: monthly stats, per-person activity, setup progress ───────
// Everything the Team tab shows beyond what getOfficeAnalytics already counts.
// Scoped to ONE office; callers must have passed requireOfficeAdmin first.
//
// "This month" is the CALENDAR month (what a small-business owner means by it),
// compared against the previous calendar month.

export const ACTIVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // idle after 14 quiet days

// A month-over-month arrow needs a baseline worth comparing against. Going from
// 1 lead to 2 is "+100%", which reads like a trend and is really just noise —
// so below this many events last month we show the number with no delta at all.
const MIN_BASELINE_FOR_DELTA = 5;

export type MonthStat = {
  current: number;
  previous: number;
  // null when last month is zero or too thin to draw a conclusion from.
  deltaPct: number | null;
};

// The six states an owner can see. Deliberately a closed set — no raw enums
// reach the UI, and every one of them implies a different next action.
export type MemberStatus =
  | "active"            // live card + activity in the window
  | "card_incomplete"   // accepted the invite, never built a card
  | "card_deactivated"  // has cards, all of them switched off
  | "idle"              // live card, but nothing has happened lately
  | "invite_sent"       // pending invitation, still valid
  | "invite_expired";   // pending invitation, past its window

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  active: "Active",
  card_incomplete: "Card not completed",
  card_deactivated: "Card deactivated",
  idle: "Not using it yet",
  invite_sent: "Invite sent",
  invite_expired: "Invite expired",
};

export type TeamPerson = EmployeeAnalytics & {
  kind: "member";
  memberRowId: string | null; // office_members.id — null for the owner (no row)
  title: string | null;
  email: string | null;
  photoUrl: string | null;
  // Latest card view or captured lead on any of their cards. Null = never.
  lastActiveAt: string | null;
  liveCards: number;
  totalCards: number;
  status: MemberStatus;
};

export type TeamInvite = {
  kind: "invite";
  memberRowId: string;
  email: string;
  inviteToken: string | null;
  sentAt: string | null;
  status: "invite_sent" | "invite_expired";
};

export type TeamRow = TeamPerson | TeamInvite;

export type TeamOverview = {
  stats: {
    leadsThisMonth: MonthStat;
    viewsThisMonth: MonthStat;
    activation: ActivationRate;
    seats: SeatUsage;
  };
  people: TeamPerson[];
  invites: TeamInvite[];
  totals: { members: number; cards: number; views: number; leads: number };
};

function monthStartIso(offset: 0 | 1, now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  return d.toISOString();
}

export function deltaPct(current: number, previous: number): number | null {
  if (previous < MIN_BASELINE_FOR_DELTA) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ── Team activation rate ─────────────────────────────────────────────────────
// "Team members with a completed live card ÷ total invited team members."
// The OWNER is excluded from both sides: they aren't invited, and they always
// have a card (their card is the brand), so including them would inflate the
// rate toward 100% and hide the exact problem this measures — people who were
// invited and never finished. Pure so it's unit-testable.

export type ActivationRate = {
  activated: number;
  invited: number;
  // null when nobody has been invited yet — 0/0 is not "0% activated".
  pct: number | null;
};

export function computeActivation(input: { activatedMembers: number; invitedTotal: number }): ActivationRate {
  const activated = Math.max(0, input.activatedMembers);
  const invited = Math.max(0, input.invitedTotal);
  return { activated, invited, pct: invited > 0 ? Math.round((activated / invited) * 100) : null };
}

export function memberStatus(input: {
  liveCards: number;
  totalCards: number;
  lastActiveAt: string | null;
  now?: number;
}): MemberStatus {
  const now = input.now ?? Date.now();
  if (input.totalCards === 0) return "card_incomplete";
  if (input.liveCards === 0) return "card_deactivated";
  const active = !!input.lastActiveAt && now - new Date(input.lastActiveAt).getTime() < ACTIVE_WINDOW_MS;
  return active ? "active" : "idle";
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

type MemberRow = {
  id: string;
  user_id: string | null;
  invite_email: string | null;
  invite_token: string | null;
  status: string;
  created_at?: string | null;
  expires_at?: string | null;
};

export async function getTeamOverview(
  officeId: string,
  ownerId: string,
  purchasedSeats: number,
): Promise<TeamOverview> {
  const admin = getAdminSupabase();
  const analytics = await getOfficeAnalytics(officeId, ownerId);

  const userIds = analytics.employees.map((e) => e.userId);
  const perUserSlugs = await slugsByUser(userIds);
  const allSlugs = Array.from(new Set(userIds.flatMap((id) => perUserSlugs.get(id) ?? [])));

  const now = new Date();
  const thisMonth = monthStartIso(0, now);
  const lastMonth = monthStartIso(1, now);

  // Month counts: cheap head-count queries instead of pulling rows.
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

  const [
    viewsCur, viewsPrev, leadsCur, leadsPrev,
    { data: memberRows }, { data: profileRows }, { data: cardRows },
    seats,
    ...lastActives
  ] = await Promise.all([
    countViews(thisMonth),
    countViews(lastMonth, thisMonth),
    countLeads(thisMonth),
    countLeads(lastMonth, thisMonth),
    admin.from("office_members")
      .select("id, user_id, invite_email, invite_token, status, created_at, expires_at")
      .eq("office_id", officeId),
    admin.from("profiles").select("id, title, email, photo_url").in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    admin.from("cards").select("user_id, is_offline").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    getOfficeSeatUsage(officeId, purchasedSeats),
    ...userIds.map((id) => lastActive(id)),
  ]);

  const rows = (memberRows ?? []) as MemberRow[];
  const rowByUser = new Map(rows.filter((r) => r.user_id).map((r) => [r.user_id as string, r]));
  const profById = new Map((profileRows ?? []).map((p) => [p.id as string, p]));

  // is_offline may be missing pre-migration → treat an unreadable flag as live
  // rather than telling an owner their whole team is deactivated.
  const cardCounts = new Map<string, { total: number; live: number }>();
  for (const c of cardRows ?? []) {
    const uid = c.user_id as string;
    const cur = cardCounts.get(uid) ?? { total: 0, live: 0 };
    cur.total++;
    if (c.is_offline !== true) cur.live++;
    cardCounts.set(uid, cur);
  }

  const people: TeamPerson[] = analytics.employees.map((e, i) => {
    const counts = cardCounts.get(e.userId) ?? { total: 0, live: 0 };
    const prof = profById.get(e.userId);
    const lastActiveAt = lastActives[i] ?? null;
    return {
      ...e,
      kind: "member" as const,
      memberRowId: rowByUser.get(e.userId)?.id ?? null,
      title: (prof?.title as string | null) || null,
      email: (prof?.email as string | null) || null,
      photoUrl: (prof?.photo_url as string | null) || null,
      lastActiveAt,
      liveCards: counts.live,
      totalCards: counts.total,
      status: memberStatus({ liveCards: counts.live, totalCards: counts.total, lastActiveAt }),
    };
  });
  // The owner-first pin made sense on the old Overview; the Team table sorts by
  // results instead — highest leads first, views as the tiebreak.
  people.sort((a, b) => b.leads - a.leads || b.views - a.views);

  const invites: TeamInvite[] = rows
    .filter((r) => r.status === "pending")
    .map((r) => ({
      kind: "invite" as const,
      memberRowId: r.id,
      email: (r.invite_email as string) ?? "",
      inviteToken: (r.invite_token as string | null) ?? null,
      sentAt: r.created_at ?? null,
      status: isInviteExpired(r) ? ("invite_expired" as const) : ("invite_sent" as const),
    }));

  // Activation: everyone invited (accepted or still pending), against those who
  // actually got a live card up. The owner is on neither side — see computeActivation.
  const invitedTotal = people.filter((p) => !p.isOwner).length + invites.length;
  const activatedMembers = people.filter((p) => !p.isOwner && p.liveCards > 0).length;

  return {
    stats: {
      leadsThisMonth: { current: leadsCur, previous: leadsPrev, deltaPct: deltaPct(leadsCur, leadsPrev) },
      viewsThisMonth: { current: viewsCur, previous: viewsPrev, deltaPct: deltaPct(viewsCur, viewsPrev) },
      activation: computeActivation({ activatedMembers, invitedTotal }),
      seats,
    },
    people,
    invites,
    totals: analytics.totals,
  };
}

// ── First-time setup checklist ───────────────────────────────────────────────
// Derived from durable facts rather than a stored flag: once all four are true
// they stay true, and the checklist never renders again.

export type SetupProgress = {
  brandingDone: boolean;
  invitedDone: boolean;
  cardLiveDone: boolean;
  firstLeadDone: boolean;
  completed: number;
  total: number;
  allDone: boolean;
};

export function computeSetupProgress(input: {
  hasBrand: boolean;
  memberRowCount: number;   // any status — an invite that was sent counts, even if later revoked
  liveEmployeeCards: number; // employees (not the owner) with a live card
  leadCount: number;
}): SetupProgress {
  const brandingDone = input.hasBrand;
  const invitedDone = input.memberRowCount > 0;
  const cardLiveDone = input.liveEmployeeCards > 0;
  const firstLeadDone = input.leadCount > 0;
  const steps = [brandingDone, invitedDone, cardLiveDone, firstLeadDone];
  const completed = steps.filter(Boolean).length;
  return {
    brandingDone, invitedDone, cardLiveDone, firstLeadDone,
    completed, total: steps.length, allDone: completed === steps.length,
  };
}
