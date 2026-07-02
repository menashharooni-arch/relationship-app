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

  const checks: [string, PromiseLike<{ error: { message: string } | null; count?: number | null }>][] = [
    ["push_subscriptions", admin.from("push_subscriptions").select("endpoint, p256dh, auth, user_id", { count: "exact", head: true })],
    ["notifications", admin.from("notifications").select("*", { count: "exact", head: true })],
    ["milestone_count_query", admin.from("card_views").select("*", { count: "exact", head: true }).in("username", ["menash", "menash__links"])],
    ["milestone_dedupe_query", admin.from("notifications").select("id", { count: "exact", head: true }).eq("card_owner", "menash").eq("type", "milestone_5")],
  ];
  for (const [name, q] of checks) {
    try {
      const { error, count } = await q;
      out[name] = error ? { ok: false, error: error.message } : { ok: true, rows: count };
    } catch (e) {
      out[name] = { ok: false, error: String(e) };
    }
  }
  const failures = Object.entries(out).filter(([, r]) => !r.ok).map(([k]) => k);
  return NextResponse.json({ allOk: failures.length === 0, failures, out });
}
