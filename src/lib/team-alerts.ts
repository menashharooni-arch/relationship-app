import { getAdminSupabase } from "@/lib/supabase-admin";
import { notifyOffice, type OfficeNotificationType } from "@/lib/office-notify";
import { sendPushToUser } from "@/lib/push";
import { isAssignableRole, roleHasCapability } from "@/lib/office-roles";

// ── What an Office admin hears about their TEAM ─────────────────────────────
//
// Owner, 2026-09-22: "in their admin account do they get any notifications to
// their phones if their team hits any certain milestones … We obviously don't
// want their account to get spammed because they're going to have multiple
// subusers under them."
//
// So the admin hears about the TEAM, never about each member's events. A
// teammate's views and leads keep going to THAT teammate (their own bell and
// phone); the admin's own card keeps its own personal alerts. What reaches the
// admin is short, rolled up and worth acting on:
//
//   bell (office_notifications, the /office/admin bell) — everything below
//   phone (category team_alert, ≤2 a day, lib/push-policy) — only when `push`
//     is set: a teammate joined, a teammate's first lead, leads waiting a day,
//     a team milestone. Expired invites are bell-only.
//   Monday (category weekly_recap) — the team's week (api/push/recap).
//
// WHO IS AN ADMIN HERE: the owner, and any active member whose role can see the
// team's numbers (view_org_analytics — admin, manager, billing admin). The same
// capability that opens this bell in the console.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

/** The office owner plus every active member whose role sees team analytics. */
export async function teamAlertRecipients(officeId: string): Promise<string[]> {
  const admin = getAdminSupabase();
  const { data: office } = await admin.from("offices").select("owner_id").eq("id", officeId).maybeSingle();
  const ids = new Set<string>();
  if (office?.owner_id) ids.add(office.owner_id as string);
  const { data: members } = await admin
    .from("office_members")
    .select("user_id, role")
    .eq("office_id", officeId)
    .eq("status", "active");
  for (const m of members ?? []) {
    const role = typeof m.role === "string" && isAssignableRole(m.role) ? m.role : "employee";
    if (m.user_id && roleHasCapability(role, "view_org_analytics")) ids.add(m.user_id as string);
  }
  return [...ids];
}

/** Is this person someone who receives team alerts for some office? */
export async function isTeamAlertRecipient(userId: string): Promise<boolean> {
  const admin = getAdminSupabase();
  const { data: owned } = await admin.from("offices").select("id").eq("owner_id", userId).limit(1).maybeSingle();
  if (owned) return true;
  const { data: m } = await admin
    .from("office_members").select("role").eq("user_id", userId).eq("status", "active").limit(1).maybeSingle();
  const role = typeof m?.role === "string" && isAssignableRole(m.role) ? m.role : "employee";
  return !!m && roleHasCapability(role, "view_org_analytics");
}

export type TeamAlert = {
  type: OfficeNotificationType;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
  /** Also to the admins' phones (team_alert). Omit for bell-only news. */
  push?: { title?: string; body?: string; path?: string };
  /** Don't notify these users' phones (e.g. the teammate the news is about). */
  skipPushFor?: string[];
};

/**
 * One team event: a row in the admin bell and, when `push` is set, a push to
 * each admin — through sendPushToUser, so their switch, quiet hours and the
 * two-a-day cap all apply. Best-effort: never throws into the caller.
 */
export async function alertTeam(officeId: string, alert: TeamAlert): Promise<void> {
  if (!officeId) return;
  await notifyOffice(officeId, { type: alert.type, title: alert.title, body: alert.body, meta: alert.meta });
  if (!alert.push) return;
  try {
    const recipients = (await teamAlertRecipients(officeId)).filter((id) => !alert.skipPushFor?.includes(id));
    await Promise.all(recipients.map((userId) =>
      sendPushToUser(userId, {
        category: "team_alert",
        title: alert.push!.title ?? alert.title,
        body: alert.push!.body ?? alert.body,
        url: `${APP_URL}${alert.push!.path ?? "/office/admin"}`,
        tag: `team-${alert.type}`,
      }).catch(() => {}),
    ));
  } catch { /* best-effort */ }
}

/** The active office a user is a MEMBER of (not owner), or null. */
export async function memberOfficeId(userId: string): Promise<string | null> {
  const { data } = await getAdminSupabase()
    .from("office_members").select("office_id").eq("user_id", userId).eq("status", "active").limit(1).maybeSingle();
  return (data?.office_id as string | undefined) ?? null;
}

/**
 * A TEAMMATE's first-ever lead — the moment a new person's card proves itself,
 * and the one per-member event worth an admin's phone (it happens once per
 * person, ever). Not for the owner's own cards: that news is already on the
 * owner's personal phone. Ledgered by the bell row, so a retry or a race
 * cannot announce it twice.
 */
export async function announceFirstLeadIfTeammate(userId: string, memberName: string | null): Promise<void> {
  try {
    const officeId = await memberOfficeId(userId);
    if (!officeId) return;
    const admin = getAdminSupabase();
    const { data: cards } = await admin.from("cards").select("username").eq("user_id", userId);
    const slugs = (cards ?? []).map((c) => c.username as string).filter(Boolean);
    if (!slugs.length) return;
    const { count } = await admin.from("leads").select("id", { count: "exact", head: true }).in("card_owner", slugs);
    if (count !== 1) return;
    const { data: already } = await admin
      .from("office_notifications").select("id")
      .eq("office_id", officeId).eq("type", "member_first_lead").contains("meta", { userId })
      .limit(1);
    if (already?.length) return;
    const first = (memberName ?? "").trim().split(/\s+/)[0] || "A teammate";
    await alertTeam(officeId, {
      type: "member_first_lead",
      title: `First lead for ${first} 🎉`,
      body: `${first}'s card just captured its first lead. It's in the Leads tab.`,
      meta: { userId },
      push: { path: "/office/admin/leads" },
      skipPushFor: [userId],
    });
  } catch { /* best-effort */ }
}

// ── Team milestones ─────────────────────────────────────────────────────────
// Round numbers only, and each announced once per office, ever (the bell row
// is the ledger). Pure so the thresholds are testable.
export const TEAM_VIEW_MILESTONES = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
export const TEAM_LEAD_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

/** The highest milestone reached that has not been announced, or null. */
export function nextTeamMilestone(total: number, ladder: number[], announced: number[]): number | null {
  const reached = ladder.filter((n) => total >= n && !announced.includes(n));
  return reached.length ? reached[reached.length - 1] : null;
}

export function formatCount(n: number): string {
  return n >= 1000 && n % 1000 === 0 ? `${n / 1000}k` : n.toLocaleString("en-US");
}
