import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { armWatchdogLoop, isContinuous } from "@/lib/agent-watchdog";

// Per-agent + system settings, editable from the UI without a deploy.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null) as
    | { agent_id?: string; enabled?: boolean; output_cap?: number; usage_cap_tokens?: number; schedule?: string | null;
        system?: { monthly_usage_cap_tokens?: number; digest_email?: string; auto_pause_at?: string | null; weekly_focus?: string | null } }
    | null;
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const admin = getAdminSupabase();
  if (body.system) {
    if (body.system.weekly_focus !== undefined) body.system.weekly_focus = body.system.weekly_focus ? String(body.system.weekly_focus).slice(0, 400) : null;
    const { error } = await admin.from("agent_system").update({ ...body.system, updated_at: new Date().toISOString() }).eq("id", true);
    // weekly_focus arrives with supabase/agent-brain.sql §7; until it runs, say so instead of a silent no-op.
    if (error) return NextResponse.json({ error: /weekly_focus/.test(error.message) ? "Run supabase/agent-brain.sql in the SQL editor first (adds weekly_focus)." : error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (!body.agent_id) return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (Number.isFinite(body.output_cap)) patch.output_cap = Math.max(1, Math.min(200, Number(body.output_cap)));
  if (Number.isFinite(body.usage_cap_tokens)) patch.usage_cap_tokens = Math.max(50_000, Math.min(10_000_000, Math.round(Number(body.usage_cap_tokens))));
  // A watchdog has no cadence to set — ignore any schedule aimed at one rather
  // than writing a value that nothing reads (owner order 2026-09-03).
  if (body.schedule !== undefined && !isContinuous(body.agent_id)) patch.schedule = body.schedule || null;
  // The owner's hand outranks the agent's playbook: a schedule he sets is
  // never overwritten by research; clearing it hands the rhythm back to the
  // playbook (which writes 'playbook') or config ('default').
  if ("schedule" in patch) patch.schedule_source = patch.schedule ? "owner" : "default";
  const { error } = await admin.from("agent_settings").update(patch).eq("agent_id", body.agent_id);
  // Before supabase/agent-brain.sql runs the column does not exist; keep the
  // rest of the settings write working rather than failing the whole request.
  if (error && "schedule_source" in patch) {
    delete patch.schedule_source;
    await admin.from("agent_settings").update(patch).eq("agent_id", body.agent_id);
  }
  // Ticking a watchdog Active is the go signal: start watching NOW, not at the
  // next backstop tick.
  if (body.enabled === true && isContinuous(body.agent_id)) await armWatchdogLoop("active_toggle");
  return NextResponse.json({ ok: true });
}
