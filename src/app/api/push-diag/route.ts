import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// TEMPORARY: verifies the notification tables + queries used by push alerts
// and view milestones against the live DB. Token-guarded; removed after use.
const TOKEN = "pQ4mV8xT2nJ6bR9wK3cZ7yF5hL1sD0aE";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const admin = getAdminSupabase();
  const out: Record<string, { ok: boolean; error?: string; rows?: number | null }> = {};

  const checks: [string, PromiseLike<{ error: object | null; count?: number | null; data?: unknown[] | null }>][] = [
    ["push_subscriptions", admin.from("push_subscriptions").select("endpoint, p256dh, auth, user_id", { count: "exact", head: true })],
    ["notifications", admin.from("notifications").select("*", { count: "exact", head: true })],
    ["notifications_columns", admin.from("notifications").select("id, user_id, card_owner, type, title, body").limit(1)],
    ["milestone_count_query", admin.from("card_views").select("*", { count: "exact", head: true }).in("username", ["menash", "menash__links"])],
    // The EXACT dedupe query milestones.ts runs:
    ["milestone_dedupe_exact", admin.from("notifications").select("id").eq("card_owner", "menash").eq("type", "milestone_5").limit(1)],
  ];
  for (const [name, q] of checks) {
    try {
      const { error, count, data } = await q;
      out[name] = error
        ? { ok: false, error: JSON.stringify(error) }
        : { ok: true, rows: count ?? (Array.isArray(data) ? data.length : null) };
    } catch (e) {
      out[name] = { ok: false, error: String(e) };
    }
  }
  // Actual shape of the table: dump the existing row's keys.
  let actualColumns: string[] = [];
  try {
    const { data: sample } = await admin.from("notifications").select("*").limit(1);
    actualColumns = sample?.[0] ? Object.keys(sample[0]) : [];
  } catch { /* ignore */ }

  // End-to-end through the REAL helper (must fall back and land a row).
  const { data: prof } = await admin.from("profiles").select("id").eq("username", "menash").maybeSingle();
  if (prof?.id) {
    const { insertNotification } = await import("@/lib/notify");
    await insertNotification({ user_id: prof.id, card_owner: "menash", type: "diag_test", title: "diag", body: "diag" });
    const { data: found } = await admin.from("notifications").select("id").eq("user_id", prof.id).eq("type", "diag_test").limit(1);
    out["insert_notification_e2e"] = { ok: !!found?.length, error: JSON.stringify({ actualColumns }) };
    await admin.from("notifications").delete().eq("user_id", prof.id).eq("type", "diag_test");
  } else {
    out["insert_notification_e2e"] = { ok: false, error: "no menash profile" };
  }

  const failures = Object.entries(out).filter(([, r]) => !r.ok).map(([k]) => k);
  return NextResponse.json({ allOk: failures.length === 0, failures, out });
}
