import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { sendPushToUser } from "@/lib/push";
import { insertNotification } from "@/lib/notify";
import { readPushPrefs } from "@/lib/push-policy";
import { WORKED_STATUS_VALUES } from "@/lib/lead-status";
import {
  alertTeam, formatCount, nextTeamMilestone, teamAlertRecipients,
  TEAM_LEAD_MILESTONES, TEAM_VIEW_MILESTONES,
} from "@/lib/team-alerts";
import { displayLabelFrom } from "@/lib/office-notify";
import { isRecapHour, isTeamCheckHour, personalRecapCopy, rankPlaces, teamRecapCopy } from "@/lib/weekly-recap";

// ── The hourly notification sweep: Monday recaps + the daily team check ─────
//
// Owner, 2026-09-22. Called every hour by .github/workflows/push-catchup.yml
// (same schedule and secret as the 8am catch-up, for the same Hobby-plan
// reason). Each part decides for itself whether this hour is its hour:
//
//   1. WEEKLY RECAP — Monday 9am in each person's own zone. One push each:
//      an Office admin (of a team with at least one teammate) gets the TEAM's
//      week, everyone else their own. Marked in push_log BEFORE sending, so a
//      duplicate run cannot buzz twice. Nothing for an empty week.
//   2. TEAM CHECK — 9am in the owner's zone, every day, per office with a team:
//      leads still New after 24h (only ones not already announced), a team
//      milestone crossed, invitations that expired (bell only). Every piece is
//      ledgered in office_notifications, so reruns are no-ops.
//
// Pushes go through sendPushToUser: the person's switches, quiet hours and the
// team_alert cap of two a day all still apply.

export const runtime = "nodejs";
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";
const DAY = 24 * 3600 * 1000;
const RECAP_MARK = "recap";

type Admin = ReturnType<typeof getAdminSupabase>;

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const accepted = [process.env.PUSH_CATCHUP_SECRET, process.env.CRON_SECRET]
    .filter((s): s is string => Boolean(s))
    .map((s) => `Bearer ${s}`);
  // An unset secret must never authorize (`Bearer undefined`).
  return accepted.length > 0 && !!auth && accepted.includes(auth);
}

/** Every slug a set of users' cards answer to, including the Swift Links key. */
async function slugsFor(admin: Admin, userIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!userIds.length) return out;
  const { data } = await admin.from("cards").select("user_id, username").in("user_id", userIds);
  for (const c of data ?? []) {
    const list = out.get(c.user_id as string) ?? [];
    if (c.username) list.push(c.username as string);
    out.set(c.user_id as string, list);
  }
  return out;
}
const viewKeys = (slugs: string[]) => slugs.flatMap((s) => [s, `${s}__links`]);

/** Offices with at least one active teammate: ownerId → { officeId, memberIds }. */
async function teams(admin: Admin): Promise<Map<string, { officeId: string; ownerId: string; memberIds: string[] }>> {
  const { data: members } = await admin.from("office_members").select("office_id, user_id").eq("status", "active");
  const byOffice = new Map<string, string[]>();
  for (const m of members ?? []) {
    if (!m.user_id) continue;
    byOffice.set(m.office_id as string, [...(byOffice.get(m.office_id as string) ?? []), m.user_id as string]);
  }
  const out = new Map<string, { officeId: string; ownerId: string; memberIds: string[] }>();
  if (!byOffice.size) return out;
  const { data: offices } = await admin.from("offices").select("id, owner_id").in("id", [...byOffice.keys()]);
  for (const o of offices ?? []) {
    out.set(o.id as string, { officeId: o.id as string, ownerId: o.owner_id as string, memberIds: byOffice.get(o.id as string) ?? [] });
  }
  return out;
}

async function alreadyRecapped(admin: Admin, userId: string, now: number): Promise<boolean> {
  const { data } = await admin.from("push_log").select("id")
    .eq("user_id", userId).eq("outcome", RECAP_MARK)
    .gte("created_at", new Date(now - 6 * DAY).toISOString()).limit(1);
  return !!data?.length;
}

async function markRecap(admin: Admin, userId: string, plan: string): Promise<void> {
  await admin.from("push_log").insert({ user_id: userId, category: "weekly_recap", plan, outcome: RECAP_MARK, endpoints: 0 });
}

async function teamWeek(admin: Admin, team: { ownerId: string; memberIds: string[] }, now: number) {
  const people = [team.ownerId, ...team.memberIds];
  const slugs = await slugsFor(admin, people);
  const since = new Date(now - 7 * DAY).toISOString();
  const { data: names } = await admin.from("cards").select("user_id, name").in("user_id", people);
  const nameOf = new Map<string, string>();
  for (const c of names ?? []) if (c.name && !nameOf.has(c.user_id as string)) nameOf.set(c.user_id as string, c.name as string);

  let views = 0, leads = 0, quiet = 0;
  let top: { name: string; leads: number; views: number } | null = null;
  for (const uid of people) {
    const s = slugs.get(uid) ?? [];
    if (!s.length) continue;
    const [{ count: v }, { count: l }] = await Promise.all([
      admin.from("card_views").select("id", { count: "exact", head: true }).in("username", viewKeys(s)).gte("viewed_at", since),
      admin.from("leads").select("id", { count: "exact", head: true }).in("card_owner", s).gte("created_at", since),
    ]);
    const pv = v ?? 0, pl = l ?? 0;
    views += pv; leads += pl;
    if (uid !== team.ownerId && pv === 0) quiet++;
    if ((pl > 0 || pv > 0) && (!top || pl > top.leads || (pl === top.leads && pv > top.views))) {
      top = { name: nameOf.get(uid) ?? "A teammate", leads: pl, views: pv };
    }
  }
  return { views, leads, quiet, top };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdminSupabase();
  const now = Date.now();
  const counts = { recapsPersonal: 0, recapsTeam: 0, teamChecks: 0, leadsWaiting: 0, milestones: 0, invitesExpired: 0 };

  const allTeams = await teams(admin);
  // Who receives the TEAM recap instead of their own: admins of a real team.
  const teamOf = new Map<string, { officeId: string; ownerId: string; memberIds: string[] }>();
  for (const t of allTeams.values()) {
    for (const uid of await teamAlertRecipients(t.officeId)) teamOf.set(uid, t);
  }

  // ── 1. Monday recaps ──────────────────────────────────────────────────────
  const { data: subs } = await admin.from("push_subscriptions").select("user_id");
  const userIds = [...new Set((subs ?? []).map((s) => s.user_id as string))];
  const profiles = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await admin.from("profiles").select("id, plan, customization").in("id", userIds.slice(i, i + 200));
    for (const p of data ?? []) profiles.set(p.id as string, p);
  }
  for (const userId of userIds) {
    try {
      const profile = profiles.get(userId);
      const prefs = readPushPrefs(profile?.customization);
      if (prefs.weekly_recap === false) continue;
      if (!isRecapHour(now, prefs.timezone)) continue;
      if (await alreadyRecapped(admin, userId, now)) continue;
      const plan = (profile?.plan as string | null) ?? "free";

      const team = teamOf.get(userId);
      if (team) {
        const copy = teamRecapCopy(await teamWeek(admin, team, now));
        if (!copy) continue;
        await markRecap(admin, userId, plan);
        // One bell row per office per week, however many admins it has.
        const { data: had } = await admin.from("office_notifications").select("id")
          .eq("office_id", team.officeId).eq("type", "team_weekly_recap")
          .gte("created_at", new Date(now - 6 * DAY).toISOString()).limit(1);
        if (!had?.length) await alertTeam(team.officeId, { type: "team_weekly_recap", title: copy.title, body: copy.body });
        await sendPushToUser(userId, { category: "weekly_recap", title: copy.title, body: copy.body, url: `${APP_URL}/office/admin/analytics`, tag: "weekly-recap" });
        counts.recapsTeam++;
        continue;
      }

      const slugs = (await slugsFor(admin, [userId])).get(userId) ?? [];
      if (!slugs.length) continue;
      const since = new Date(now - 7 * DAY).toISOString();
      const [{ data: views }, { count: contacts }] = await Promise.all([
        admin.from("card_views").select("location").in("username", viewKeys(slugs)).gte("viewed_at", since).limit(5000),
        admin.from("leads").select("id", { count: "exact", head: true }).in("card_owner", slugs).gte("created_at", since),
      ]);
      const copy = personalRecapCopy({
        views: views?.length ?? 0,
        contacts: contacts ?? 0,
        places: rankPlaces((views ?? []).map((v) => v.location as string | null)),
      });
      if (!copy) continue;
      await markRecap(admin, userId, plan);
      // The bell row carries the marked place: blurred for Free, like any view.
      await insertNotification({ user_id: userId, type: "weekly_recap", title: copy.title, body: copy.body });
      await sendPushToUser(userId, { category: "weekly_recap", title: copy.title, body: copy.body, url: `${APP_URL}/dashboard`, tag: "weekly-recap" });
      counts.recapsPersonal++;
    } catch (e) {
      console.error("[push] recap failed for a user:", e instanceof Error ? e.message : e);
    }
  }

  // ── 2. The daily team check ───────────────────────────────────────────────
  for (const team of allTeams.values()) {
    try {
      const { data: owner } = await admin.from("profiles").select("customization").eq("id", team.ownerId).maybeSingle();
      if (!isTeamCheckHour(now, readPushPrefs(owner?.customization).timezone)) continue;
      counts.teamChecks++;

      const people = [team.ownerId, ...team.memberIds];
      const slugMap = await slugsFor(admin, people);
      const slugs = [...slugMap.values()].flat();
      if (!slugs.length) continue;

      // Leads still New a day on (but not older than a week — stale leads are
      // the Leads tab's job, not a phone's). Only ones not yet announced.
      const { data: waiting } = await admin.from("leads").select("id, status")
        .in("card_owner", slugs)
        .lte("created_at", new Date(now - DAY).toISOString())
        .gte("created_at", new Date(now - 7 * DAY).toISOString())
        .limit(500);
      const worked = new Set<string>(WORKED_STATUS_VALUES);
      const waitingIds = (waiting ?? []).filter((l) => !worked.has(String(l.status ?? "").toLowerCase())).map((l) => l.id as string);
      if (waitingIds.length) {
        const { data: prior } = await admin.from("office_notifications").select("meta")
          .eq("office_id", team.officeId).eq("type", "leads_waiting")
          .gte("created_at", new Date(now - 8 * DAY).toISOString());
        const told = new Set<string>((prior ?? []).flatMap((r) => ((r.meta as { leadIds?: string[] } | null)?.leadIds ?? [])));
        const fresh = waitingIds.filter((id) => !told.has(id));
        if (fresh.length) {
          const n = waitingIds.length;
          await alertTeam(team.officeId, {
            type: "leads_waiting",
            title: n === 1 ? "1 team lead is waiting" : `${n} team leads are waiting`,
            body: "Still marked New a day after they came in. See who in Leads.",
            meta: { leadIds: waitingIds },
            push: { path: "/office/admin/leads" },
          });
          counts.leadsWaiting++;
        }
      }

      // Team milestones — all-time totals, each round number once, ever.
      const [{ count: totalViews }, { count: totalLeads }] = await Promise.all([
        admin.from("card_views").select("id", { count: "exact", head: true }).in("username", viewKeys(slugs)),
        admin.from("leads").select("id", { count: "exact", head: true }).in("card_owner", slugs),
      ]);
      const { data: ms } = await admin.from("office_notifications").select("meta")
        .eq("office_id", team.officeId).eq("type", "team_milestone");
      // A row records its own rung AND every lower one it jumped past (meta.also),
      // so an office that crossed several at once never hears about the lower ones later.
      const announced = (kind: string) => (ms ?? [])
        .map((r) => r.meta as { kind?: string; n?: number; also?: number[] } | null)
        .filter((m) => m?.kind === kind)
        .flatMap((m) => [m!.n as number, ...(m!.also ?? [])]);
      const viewHit = nextTeamMilestone(totalViews ?? 0, TEAM_VIEW_MILESTONES, announced("views"));
      const leadHit = nextTeamMilestone(totalLeads ?? 0, TEAM_LEAD_MILESTONES, announced("leads"));
      // Leads first: if both crossed on one day, that is the one to buzz for;
      // the other still gets its bell row.
      for (const [kind, hit, push] of [["leads", leadHit, true], ["views", viewHit, !leadHit]] as const) {
        if (!hit) continue;
        const ladder = kind === "leads" ? TEAM_LEAD_MILESTONES : TEAM_VIEW_MILESTONES;
        await alertTeam(team.officeId, {
          type: "team_milestone",
          title: `Your team passed ${formatCount(hit)} ${kind === "leads" ? "leads" : "card views"} 🎉`,
          body: kind === "leads" ? "Every lead your team has captured, all time." : "Every view across your team's cards, all time.",
          // Record every rung reached, so a jump past several never announces the lower ones later.
          meta: { kind, n: hit, also: ladder.filter((x) => x < hit) },
          ...(push ? { push: { path: "/office/admin/analytics" } } : {}),
        });
        counts.milestones++;
      }

      // Invitations that ran out unanswered in the last week — bell only.
      const { data: expired } = await admin.from("office_members").select("id, invite_name, invite_email, expires_at")
        .eq("office_id", team.officeId).eq("status", "pending")
        .lte("expires_at", new Date(now).toISOString())
        .gte("expires_at", new Date(now - 7 * DAY).toISOString());
      if (expired?.length) {
        const { data: noted } = await admin.from("office_notifications").select("meta")
          .eq("office_id", team.officeId).eq("type", "invite_expired");
        const done = new Set((noted ?? []).map((r) => (r.meta as { memberId?: string } | null)?.memberId));
        for (const inv of expired) {
          if (done.has(inv.id as string)) continue;
          const who = displayLabelFrom(inv.invite_name as string | null, inv.invite_email as string | null);
          await alertTeam(team.officeId, {
            type: "invite_expired",
            title: `${who}'s invitation expired`,
            body: "They never accepted. Send it again from the Team tab — the seat is still yours.",
            meta: { memberId: inv.id },
          });
          counts.invitesExpired++;
        }
      }
    } catch (e) {
      console.error("[push] team check failed for an office:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true, ...counts });
}
