import { getAdminSupabase } from "@/lib/supabase-admin";

// ── Office "team inbox" notifications ────────────────────────────────────────
// Deliberately SEPARATE from the personal per-user notifications (public
// notifications table, keyed by user_id). These live in office_notifications,
// keyed by office_id, and surface ONLY on the /office/admin bell — never in the
// admin's own dashboard bell. Two different tables = zero chance of bleed.
//
// This inbox is intentionally LOW-NOISE: only team-level events an owner
// actually needs (someone joined, someone left, an invite was declined). It must
// NEVER carry small per-lead activity like "a contact was saved" — that belongs
// on the individual member's personal bell, not the admin team inbox.

export type OfficeNotificationType =
  | "member_joined"     // an invited sub-user accepted and is now on the team
  | "member_left"       // a member left this team (e.g. moved to another office)
  | "invite_declined";  // an invitee declined the invitation (seat freed)

export type OfficeNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

// Emit one important team-inbox notification. Best-effort: a failure here must
// never break the action that triggered it (join, decline, …). Service-role.
export async function notifyOffice(
  officeId: string,
  n: { type: OfficeNotificationType; title: string; body?: string | null; meta?: Record<string, unknown> },
): Promise<void> {
  if (!officeId) return;
  try {
    await getAdminSupabase().from("office_notifications").insert({
      office_id: officeId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      meta: n.meta ?? null,
    });
  } catch {
    /* best-effort — never block the triggering action on a notification write */
  }
}

// The team inbox for one office, newest first. Service-role; callers gate access
// by office capability first.
export async function listOfficeNotifications(officeId: string, limit = 30): Promise<OfficeNotification[]> {
  if (!officeId) return [];
  try {
    const { data } = await getAdminSupabase()
      .from("office_notifications")
      .select("id, type, title, body, read, created_at")
      .eq("office_id", officeId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as OfficeNotification[];
  } catch {
    // Table not migrated yet, etc. — degrade to an empty inbox rather than 500
    // the whole admin shell (the bell just shows "no team updates").
    return [];
  }
}

// First name (or email local-part) for a human label in a team notification.
export function displayLabelFrom(name?: string | null, email?: string | null): string {
  const n = (name ?? "").trim();
  if (n) return n;
  const e = (email ?? "").trim();
  if (e) return e.split("@")[0];
  return "A teammate";
}
