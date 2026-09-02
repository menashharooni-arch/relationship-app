import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminSupabase } from "@/lib/supabase-admin";
import agentConfig from "../../../../../../marketing-agents/config.json";
import { firstName, ORG } from "@/lib/agent-org";

// Run controls. Pause flags live in the DB (agents poll them between steps —
// that is what makes PAUSE take effect mid-run). Run/Start-All dispatch the
// GitHub Actions workflows via the REST API using a fine-grained PAT
// (GITHUB_AGENTS_TOKEN, actions:write on this repo) set in Vercel env.
const REPO = process.env.AGENTS_GITHUB_REPO || "menashharooni-arch/relationship-app";

// Comms log: the owner's orders and Atlas's acknowledgments, written at the
// moment the real action happens. Never throws — comms must not break controls.
type AdminClient = ReturnType<typeof getAdminSupabase>;
async function say(admin: AdminClient, from_id: string, to_id: string, body: string, kind: "a2a" | "owner_in" | "owner_out" = "a2a") {
  await admin.from("agent_messages").insert({ from_id, to_id, kind, body }).then(() => {}, () => {});
}

async function dispatch(workflow: string, trigger: string): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GITHUB_AGENTS_TOKEN}`, Accept: "application/vnd.github+json" },
    body: JSON.stringify({ ref: "main", inputs: { trigger } }),
  });
  return { ok: res.status === 204, status: res.status };
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { op, agent_id } = (await req.json().catch(() => ({}))) as { op?: string; agent_id?: string };
  const admin = getAdminSupabase();
  const agents = agentConfig.agents as Record<string, { workflow: string }>;

  if (op === "pause_all" || op === "resume_all") {
    await admin.from("agent_system").update({ paused: op === "pause_all", updated_at: new Date().toISOString() }).eq("id", true);
    if (op === "pause_all") {
      await say(admin, "owner", "atlas", "Pause everything — close up for now.", "owner_in");
      await say(admin, "atlas", "all", "All hands: PAUSE. Finish your current step at the next checkpoint and stand down. Completed work stays in the queue.");
      // Immediate consolidated session summary — everything every agent got
      // through today, written at the moment of the pause (spec §RUN SUMMARIES).
      const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
      const { data: runs } = await admin.from("agent_runs").select("agent_id, status, output_count, usage_usd, summary, started_at").gte("started_at", dayStart.toISOString()).order("started_at", { ascending: true });
      const { count: pendingCount } = await admin.from("agent_queue_items").select("*", { count: "exact", head: true }).eq("status", "pending");
      const lines = (runs ?? []).map((r) => `${new Date(r.started_at).toISOString().slice(11, 16)}  ${r.agent_id.padEnd(11)} ${r.status.padEnd(9)} ${r.output_count} item(s), $${Number(r.usage_usd).toFixed(2)} — ${String(r.summary ?? "").slice(0, 100)}`);
      const spend = (runs ?? []).reduce((t, r) => t + Number(r.usage_usd), 0);
      await admin.from("agent_queue_items").insert({
        agent_id: "manager", item_type: "digest", platform: "site", target: "pause summary",
        title: `⏸ Session summary at Pause All — ${runs?.length ?? 0} run(s), ${pendingCount ?? 0} pending, $${spend.toFixed(2)}`,
        content: lines.length ? `Everything accomplished today up to the pause:\n\n${lines.join("\n")}\n\nIn-flight agents stop at their next checkpoint; completed work is kept.` : "No agent had run yet today when the system was paused.",
        context: "Generated automatically the moment PAUSE ALL was pressed.",
      });
    }
    return NextResponse.json({ ok: true });
  }
  // Whole-team switch: benches/wakes every agent reporting to a lead in one
  // click, so e.g. Maya's marketing team rests while Rex's watchers keep going.
  if ((op === "pause_team" || op === "resume_team") && agent_id && ORG[agent_id]?.kind === "lead") {
    const teamAgents = Object.values(ORG).filter((p) => p.reports_to === agent_id && p.agent_id).map((p) => p.agent_id!);
    if (!teamAgents.length) return NextResponse.json({ error: "empty team" }, { status: 400 });
    const pausing = op === "pause_team";
    await admin.from("agent_settings").update({ paused: pausing, updated_at: new Date().toISOString() }).in("agent_id", teamAgents);
    const lead = ORG[agent_id];
    await say(admin, "owner", "atlas", `${pausing ? "Stand down" : "Wake up"} ${lead.name}'s whole team for now.`, "owner_in");
    await say(admin, "atlas", agent_id, pausing
      ? "Your team stands down — everyone stops at their next checkpoint and skips their shifts until further notice. Other teams keep working."
      : "Your team is back on — everyone resumes their normal rhythms from the next window.");
    return NextResponse.json({ ok: true, count: teamAgents.length });
  }
  if ((op === "pause" || op === "resume") && agent_id) {
    await admin.from("agent_settings").update({ paused: op === "pause", updated_at: new Date().toISOString() }).eq("agent_id", agent_id);
    await say(admin, "owner", "atlas", `${op === "pause" ? "Bench" : "Unbench"} ${firstName(agent_id)} for now.`, "owner_in");
    return NextResponse.json({ ok: true });
  }
  if (!process.env.GITHUB_AGENTS_TOKEN) {
    return NextResponse.json({ error: "GITHUB_AGENTS_TOKEN is not set in Vercel — add a fine-grained PAT (actions: write) to enable Run buttons." }, { status: 503 });
  }
  if (op === "run" && agent_id && agents[agent_id]) {
    const r = await dispatch(agents[agent_id].workflow, "manual");
    if (r.ok) await say(admin, "owner", "atlas", `Run ${firstName(agent_id)} now.`, "owner_in");
    return NextResponse.json(r.ok ? { ok: true } : { error: `GitHub dispatch → ${r.status}` }, { status: r.ok ? 200 : 502 });
  }
  if (op === "start_all") {
    // Start = the system is OPEN: master pause off, any expired auto-stop
    // cleared, an immediate first round dispatched — then the scheduler keeps
    // every agent on its own cadence until Pause.
    await admin.from("agent_system").update({ paused: false, auto_pause_at: null, updated_at: new Date().toISOString() }).eq("id", true);
    const { data: settings } = await admin.from("agent_settings").select("agent_id, enabled, paused");
    const enabled = new Set((settings ?? []).filter((s) => s.enabled && !s.paused).map((s) => s.agent_id));
    await say(admin, "owner", "atlas", "We're OPEN — start everyone.", "owner_in");
    await say(admin, "atlas", "maya", "Company's open — dispatch your marketing team on their rhythms.");
    await say(admin, "atlas", "rex", "Company's open — get the watchers running.");
    const results: Record<string, boolean> = {};
    // Manager is excluded from the fan-out and dispatched by the caller later,
    // or run manually — it should summarize a session, not race it.
    for (const [id, a] of Object.entries(agents)) {
      if (id === "manager" || !enabled.has(id)) continue;
      results[id] = (await dispatch(a.workflow, "start_all")).ok;
    }
    return NextResponse.json({ ok: true, results });
  }
  return NextResponse.json({ error: "bad op" }, { status: 400 });
}
