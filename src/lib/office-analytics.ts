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
