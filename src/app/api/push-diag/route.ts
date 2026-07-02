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

  // Raw inserts, reporting each error verbatim.
  const inserts: Record<string, string> = {};
  const { data: prof } = await admin.from("profiles").select("id").eq("username", "menash").maybeSingle();
  if (prof?.id) {
    const full = await admin.from("notifications").insert({ user_id: prof.id, card_owner: "menash", type: "diag_test", title: "diag", body: "diag" });
    inserts.with_card_owner = full.error ? JSON.stringify(full.error) : "OK";
    const bare = await admin.from("notifications").insert({ user_id: prof.id, type: "diag_test", title: "diag", body: "diag" });
    inserts.without_card_owner = bare.error ? JSON.stringify(bare.error) : "OK";
    await admin.from("notifications").delete().eq("user_id", prof.id).eq("type", "diag_test");
  }
  out["insert_notification_e2e"] = { ok: inserts.without_card_owner === "OK", error: JSON.stringify({ actualColumns, inserts }) };

  const failures = Object.entries(out).filter(([, r]) => !r.ok).map(([k]) => k);
  return NextResponse.json({ allOk: failures.length === 0, failures, out });
}
