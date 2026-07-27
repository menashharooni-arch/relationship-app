import { getAdminSupabase } from "@/lib/supabase-admin";

// In-app notification writer, resilient to the notifications.card_owner column
// not existing yet (supabase/notifications-card-scope.sql not applied). Inserts
// WITH the card scope; on "column does not exist" (42703) retries without it so
// notifications are never silently dropped. Once the migration runs, scoping
// just starts working — no code change needed.
// Returns TRUE only when this call actually wrote the row. Callers that fire a
// side effect alongside the notification (e.g. a push) must gate it on this:
// with the milestone unique index in place, the loser of a concurrent race gets
// a 23505 here, and without a signal it would carry on and send a duplicate push
// for a notification it never created.
export async function insertNotification(row: {
  user_id: string;
  card_owner?: string | null;
  type: string;
  title: string;
  body: string;
}): Promise<boolean> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("notifications").insert(row);
  if (!error) return true;
  // Missing column surfaces as 42703 (Postgres) or PGRST204 (PostgREST schema
  // cache) depending on the path — retry without the card scope on either.
  const code = (error as { code?: string } | null)?.code;
  if (code === "42703" || code === "PGRST204") {
    if (row.card_owner === undefined) return false;
    const { card_owner: _unused, ...rest } = row;
    void _unused;
    const { error: retryError } = await admin.from("notifications").insert(rest);
    return !retryError;
  }
  // 23505 = a dedupe index rejected this as a duplicate: someone else already
  // wrote it. Not an error, but this call did NOT create it.
  return false;
}
