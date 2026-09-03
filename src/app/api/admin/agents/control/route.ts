import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminSupabase } from "@/lib/supabase-admin";
import agentConfig from "../../../../../../marketing-agents/config.json";
import { firstName, ORG } from "@/lib/agent-org";
import { armWatchdogLoop, isContinuous, CONTINUOUS_AGENTS } from "@/lib/agent-watchdog";

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
      const { data: runs } = await admin.from("agent_runs").select("agent_id, status, output_count, usage_tokens, summary, started_at").gte("started_at", dayStart.toISOString()).order("started_at", { ascending: true });
      const { count: pendingCount } = await admin.from("agent_queue_items").select("*", { count: "exact", head: true }).eq("status", "pending");
      const fmtTok = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
      const lines = (runs ?? []).map((r) => `${new Date(r.started_at).toISOString().slice(11, 16)}  ${r.agent_id.padEnd(11)} ${r.status.padEnd(9)} ${r.output_count} item(s), ${fmtTok(Number(r.usage_tokens ?? 0))} tok — ${String(r.summary ?? "").slice(0, 100)}`);
      const spend = (runs ?? []).reduce((t, r) => t + Number(r.usage_tokens ?? 0), 0);
      await admin.from("agent_queue_items").insert({
        agent_id: "manager", item_type: "digest", platform: "site", target: "pause summary",
        title: `⏸ Session summary at Pause All — ${runs?.length ?? 0} run(s), ${pendingCount ?? 0} pending, ${fmtTok(spend)} tokens`,
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
    // WAKE is the go signal (owner order 2026-09-02): the woken team's enabled
    // agents dispatch immediately — then the scheduler keeps their rhythms.
    // Only while the office is OPEN: waking while closed just sets the flag
    // (the runner would refuse anyway — system.paused gates every start), and
    // Start re-rests all teams when the office next opens, so Atlas says so
    // instead of quietly dispatching runs that die as "paused" rows.
    let dispatched = 0;
    if (!pausing) {
      const { data: sys } = await admin.from("agent_system").select("paused").limit(1).single();
      const openNow = sys ? !sys.paused : false;
      if (openNow && process.env.GITHUB_AGENTS_TOKEN) {
        const { data: settings } = await admin.from("agent_settings").select("agent_id, enabled").in("agent_id", teamAgents);
        const enabled = new Set((settings ?? []).filter((s) => s.enabled).map((s) => s.agent_id));
        for (const id of teamAgents) {
          if (!enabled.has(id) || !agents[id]) continue;
          // Watchdogs are not dispatched one-shot — the always-on loop is their
          // shift, and it wakes them only on a real finding (owner order
          // 2026-09-03). Arming it once covers every watchdog on the team.
          if (isContinuous(id)) continue;
          if ((await dispatch(agents[id].workflow, "team_wake")).ok) dispatched++;
        }
        if (teamAgents.some((id) => isContinuous(id) && enabled.has(id))) await armWatchdogLoop("team_wake");
      }
      await say(admin, "atlas", agent_id, openNow
        ? `Your team is AWAKE — ${dispatched} of you dispatched right now, and everyone keeps their normal rhythm from here.`
        : "Your team is set to wake — but the office is closed. Press Start to open it (note: opening rests all teams again, so wake this team after).");
    } else {
      await say(admin, "atlas", agent_id, "Your team stands down — everyone stops at their next checkpoint and skips their shifts until further notice. Other teams keep working.");
    }
    return NextResponse.json({ ok: true, count: teamAgents.length, dispatched });
  }
  if ((op === "pause" || op === "resume") && agent_id) {
    await admin.from("agent_settings").update({ paused: op === "pause", updated_at: new Date().toISOString() }).eq("agent_id", agent_id);
    await say(admin, "owner", "atlas", `${op === "pause" ? "Bench" : "Unbench"} ${firstName(agent_id)} for now.`, "owner_in");
    // Unbenching a watchdog puts it back on watch immediately.
    if (op === "resume" && isContinuous(agent_id)) await armWatchdogLoop("unbench");
    return NextResponse.json({ ok: true });
  }
  if (op === "start_all") {
    // Start = the office is OPEN, and ONLY open (owner order 2026-09-02,
    // supersedes the immediate-first-round design): master pause off, any
    // expired auto-stop cleared — and every TEAM put at rest, deterministically,
    // whatever state it was in. Nothing is dispatched and nothing runs until
    // the owner wakes a team (the go signal) or presses Run once on an agent.
    // The manager (Atlas) is the one exception left un-rested: his 5:30 PM
    // evening report is a summary of the day, not work, and the tour promises
    // it whenever the office is open.
    await admin.from("agent_system").update({ paused: false, auto_pause_at: null, updated_at: new Date().toISOString() }).eq("id", true);
    // Rested on open: every WORKER. Two standing exceptions —
    //   • manager (Atlas): his 5:30 PM report is a summary, not work.
    //   • the watchdogs (Finn, Bo, Vera, Dash): owner order 2026-09-03 — they
    //     are always on while the office is open, because a watchdog that only
    //     starts watching once you separately wake its team is not a watchdog.
    //     Resting them here is what left the site unwatched on launch day.
    const alwaysOn = ["manager", ...CONTINUOUS_AGENTS];
    await admin.from("agent_settings")
      .update({ paused: true, updated_at: new Date().toISOString() })
      .not("agent_id", "in", `(${alwaysOn.join(",")})`);
    await say(admin, "owner", "atlas", "We're OPEN — but everyone holds at rest until I wake their team.", "owner_in");
    await say(admin, "atlas", "all", "Company's open. Worker teams REST for now — you'll be woken team by team when the owner wants you working. The watch (Finn, Bo, Vera, Dash) is ON, as always while we're open, and I'll still file the evening report.");
    // The office being open is the watch's go signal.
    await armWatchdogLoop("start_all");
    return NextResponse.json({ ok: true, resting: true, watching: CONTINUOUS_AGENTS });
  }
  if (!process.env.GITHUB_AGENTS_TOKEN) {
    return NextResponse.json({ error: "GITHUB_AGENTS_TOKEN is not set in Vercel — add a fine-grained PAT (actions: write) to enable Run buttons." }, { status: 503 });
  }
  if (op === "run" && agent_id && agents[agent_id]) {
    const r = await dispatch(agents[agent_id].workflow, "manual");
    if (r.ok) await say(admin, "owner", "atlas", `Run ${firstName(agent_id)} now.`, "owner_in");
    return NextResponse.json(r.ok ? { ok: true } : { error: `GitHub dispatch → ${r.status}` }, { status: r.ok ? 200 : 502 });
  }
  return NextResponse.json({ error: "bad op" }, { status: 400 });
}
