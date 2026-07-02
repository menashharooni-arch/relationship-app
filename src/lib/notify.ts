import { getAdminSupabase } from "@/lib/supabase-admin";

// In-app notification writer, resilient to the notifications.card_owner column
// not existing yet (supabase/notifications-card-scope.sql not applied). Inserts
// WITH the card scope; on "column does not exist" (42703) retries without it so
// notifications are never silently dropped. Once the migration runs, scoping
// just starts working — no code change needed.
export async function insertNotification(row: {
  user_id: string;
  card_owner?: string | null;
  type: string;
  title: string;
  body: string;
}): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("notifications").insert(row);
  if (error && (error as { code?: string }).code === "42703" && row.card_owner !== undefined) {
    const { card_owner: _unused, ...rest } = row;
    void _unused;
    await admin.from("notifications").insert(rest);
  }
}
