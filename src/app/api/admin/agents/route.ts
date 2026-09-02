import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { connectorStatus } from "@/lib/agent-execute";

// Agent Flow: status board payload. Degrades to {ready:false} until the owner
// has run supabase/agent-flow.sql (same pattern as the referrals dashboard).
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const admin = getAdminSupabase();
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const [settings, system, runs, pending, monthRuns] = await Promise.all([
      admin.from("agent_settings").select("*").order("agent_id"),
      admin.from("agent_system").select("*").limit(1).single(),
      admin.from("agent_runs").select("*").order("started_at", { ascending: false }).limit(60),
      admin.from("agent_queue_items").select("agent_id, item_type").eq("status", "pending"),
      admin.from("agent_runs").select("agent_id, usage_usd").gte("started_at", monthStart.toISOString()),
    ]);
    if (settings.error || system.error) {
      return NextResponse.json({ ready: false, message: "Run supabase/agent-flow.sql in the Supabase SQL editor to enable Agent Flow." });
    }
    const latest: Record<string, unknown> = {};
    for (const r of runs.data ?? []) if (!latest[r.agent_id]) latest[r.agent_id] = r;
    const pendingBy: Record<string, number> = {};
    for (const q of pending.data ?? []) pendingBy[q.agent_id] = (pendingBy[q.agent_id] ?? 0) + 1;
    const spendBy: Record<string, number> = {};
    for (const r of monthRuns.data ?? []) spendBy[r.agent_id] = (spendBy[r.agent_id] ?? 0) + Number(r.usage_usd);
    return NextResponse.json({
      ready: true,
      settings: settings.data, system: system.data,
      latestRuns: latest, recentRuns: runs.data,
      pendingBy, pendingTotal: (pending.data ?? []).length, spendBy,
      dispatchConfigured: !!process.env.GITHUB_AGENTS_TOKEN,
      connectors: connectorStatus(),
    });
  } catch {
    return NextResponse.json({ ready: false, message: "Run supabase/agent-flow.sql in the Supabase SQL editor to enable Agent Flow." });
  }
}
