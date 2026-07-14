import { getAdminSupabase } from "@/lib/supabase-admin";

// ── Organization + per-employee analytics (spec §10) ─────────────────────────
// Strictly scoped to ONE office. Membership is cross-checked against
// profiles.office_id (not just an office_members row) so a removed/suspended
// member or a stale row can never leak into another org's numbers. Card views
// are keyed by card username; leads by card_owner (username). Historical rows
// for ex-members simply drop out of the current team set (they left with their
// cards) — nothing is deleted.

export type EmployeeAnalytics = {
  userId: string;
  name: string;
  username: string;
  isOwner: boolean;
  cards: number;
  views: number;
  leads: number;
};

export type OfficeAnalytics = {
  totals: { members: number; cards: number; views: number; leads: number };
  employees: EmployeeAnalytics[];
};

async function countViews(admin: ReturnType<typeof getAdminSupabase>, usernames: string[]): Promise<number> {
  if (!usernames.length) return 0;
  // card_views also logs the Swift Links surface as "<username>__links".
  const keys = usernames.flatMap((u) => [u, `${u}__links`]);
  const { count } = await admin.from("card_views").select("*", { count: "exact", head: true }).in("username", keys);
  return count ?? 0;
}

async function countLeads(admin: ReturnType<typeof getAdminSupabase>, usernames: string[]): Promise<number> {
  if (!usernames.length) return 0;
  const { count } = await admin.from("leads").select("*", { count: "exact", head: true }).in("card_owner", usernames);
  return count ?? 0;
}

// ── One person's detail ──────────────────────────────────────────────────────
// Everything the admin sees when they click into a team member. Scoped by the
// caller having already proven this user belongs to their office (see
// office-cards.getOfficeUserIds) — this helper does no authorization itself.

export type MemberCardStat = {
  id: string;
  username: string;
  name: string | null;
  label: string | null;
  isOffline: boolean;
  views: number;
  leads: number;
};

export type MemberDetail = {
  userId: string;
  name: string;
  email: string | null;
  username: string;
  joinedAt: string | null;
  totals: { cards: number; views: number; leads: number; views30: number };
  cards: MemberCardStat[];
  recentLeads: { id: string; name: string; email: string | null; created_at: string; card_owner: string }[];
};

export async function getMemberDetail(userId: string): Promise<MemberDetail | null> {
  const admin = getAdminSupabase();

  const { data: prof } = await admin
    .from("profiles")
    .select("id, name, username, email")
    .eq("id", userId)
    .maybeSingle();
  if (!prof) return null;

  // is_offline may not exist pre-migration → select * and read defensively.
  const { data: cardRows } = await admin.from("cards").select("*").eq("user_id", userId).order("created_at", { ascending: true });
  const cards = (cardRows ?? []) as Record<string, unknown>[];

  const usernames = Array.from(new Set([
    (prof.username as string) ?? "",
    ...cards.map((c) => c.username as string),
  ].filter(Boolean)));

  const [views, leads, views30, recentLeads] = await Promise.all([
    countViews(admin, usernames),
    countLeads(admin, usernames),
    countViewsSince(admin, usernames, 30),
    usernames.length
      ? admin.from("leads").select("id, name, email, created_at, card_owner").in("card_owner", usernames)
          .order("created_at", { ascending: false }).limit(10).then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  // Per-card views/leads, so the admin can see which card is actually working.
  const perCard: MemberCardStat[] = [];
  for (const c of cards) {
    const u = c.username as string;
    const [v, l] = await Promise.all([countViews(admin, [u]), countLeads(admin, [u])]);
    perCard.push({
      id: c.id as string,
      username: u,
      name: (c.name as string | null) ?? null,
      label: (c.label as string | null) ?? null,
      isOffline: c.is_offline === true,
      views: v,
      leads: l,
    });
  }

  return {
    userId,
    name: (prof.name as string) || (prof.username as string) || "Member",
    email: (prof.email as string | null) ?? null,
    username: (prof.username as string) || "",
    joinedAt: null,
    totals: { cards: cards.length, views, leads, views30 },
    cards: perCard,
    recentLeads: recentLeads as MemberDetail["recentLeads"],
  };
}

// Stats for ONE card slug — the card-detail page. No authorization here; the
// caller must already have proven the card belongs to their office.
export async function getCardStats(username: string): Promise<{ views: number; views30: number; leads: number }> {
  const admin = getAdminSupabase();
  const [views, views30, leads] = await Promise.all([
    countViews(admin, [username]),
    countViewsSince(admin, [username], 30),
    countLeads(admin, [username]),
  ]);
  return { views, views30, leads };
}

async function countViewsSince(admin: ReturnType<typeof getAdminSupabase>, usernames: string[], days: number): Promise<number> {
  if (!usernames.length) return 0;
  const keys = usernames.flatMap((u) => [u, `${u}__links`]);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("card_views")
    .select("*", { count: "exact", head: true })
    .in("username", keys)
    .gte("viewed_at", since);
  return count ?? 0;
}

// Build the analytics for an office. `ownerId` is offices.owner_id.
export async function getOfficeAnalytics(officeId: string, ownerId: string): Promise<OfficeAnalytics> {
  const admin = getAdminSupabase();

  // Team = owner + members whose profile STILL points at this office.
  const { data: memberRows } = await admin
    .from("office_members")
    .select("user_id")
    .eq("office_id", officeId)
    .eq("status", "active")
    .not("user_id", "is", null);
  const memberIds = (memberRows ?? []).map((m) => m.user_id as string);

  let verified: string[] = [];
  if (memberIds.length) {
    const { data } = await admin.from("profiles").select("id").in("id", memberIds).eq("office_id", officeId);
    verified = (data ?? []).map((p) => p.id as string);
  }
  const teamIds = Array.from(new Set([ownerId, ...verified]));

  // Names + each person's card usernames.
  const [{ data: profiles }, { data: cards }] = await Promise.all([
    admin.from("profiles").select("id, name, username").in("id", teamIds),
    admin.from("cards").select("user_id, username").in("user_id", teamIds),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const cardsByUser = new Map<string, string[]>();
  for (const c of cards ?? []) {
    const arr = cardsByUser.get(c.user_id as string) ?? [];
    arr.push(c.username as string);
    cardsByUser.set(c.user_id as string, arr);
  }

  const employees: EmployeeAnalytics[] = [];
  for (const uid of teamIds) {
    const prof = profileById.get(uid);
    // Include the profile handle (legacy profile-cards) alongside real card slugs.
    const usernames = Array.from(new Set([
      (prof?.username as string) ?? "",
      ...(cardsByUser.get(uid) ?? []),
    ].filter(Boolean)));
    const [views, leads] = await Promise.all([countViews(admin, usernames), countLeads(admin, usernames)]);
    employees.push({
      userId: uid,
      name: (prof?.name as string) || (prof?.username as string) || "Member",
      username: (prof?.username as string) || "",
      isOwner: uid === ownerId,
      cards: (cardsByUser.get(uid) ?? []).length,
      views,
      leads,
    });
  }

  // Owner first, then by views desc.
  employees.sort((a, b) => (a.isOwner ? -1 : b.isOwner ? 1 : b.views - a.views));

  const totals = {
    members: teamIds.length,
    cards: employees.reduce((s, e) => s + e.cards, 0),
    views: employees.reduce((s, e) => s + e.views, 0),
    leads: employees.reduce((s, e) => s + e.leads, 0),
  };

  return { totals, employees };
}
