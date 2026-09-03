// Reads agent_settings.schedule (cron, set from the UI) and dispatches the
// matching workflow for any agent due in this half-hour window. NULL means
// the agent works its default_schedule from config.json (owner order
// 2026-09-02: an awake, Active agent is ALWAYS working a rhythm — "manual
// only" is not a state; the Active toggle is the one per-agent switch).
import { readFileSync } from "node:fs";
import { sb } from "./lib/agentkit.mjs";
import { isDue } from "./lib/schedule.mjs";

const config = JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8"));
const rows = await sb("GET", "agent_settings", { params: "enabled=is.true&paused=is.false" });
if (!rows?.length) { console.log("No awake, active agents — nothing to dispatch."); process.exit(0); }
const sys = (await sb("GET", "agent_system", { params: "limit=1" }))[0];
if (sys.paused) { console.log("System paused — dispatching nothing."); process.exit(0); }
if (sys.auto_pause_at && new Date(sys.auto_pause_at).getTime() <= Date.now()) {
  console.log("Auto-stop is active — dispatching nothing."); process.exit(0);
}

// Dispatch decisions live in lib/schedule.mjs, shared with watchdog.mjs — the
// always-on loop is now the PRIMARY clock (it ticks every 60s; this cron fires
// every 2.5-5h despite saying */30). Both ask the same catch-up question, "is it
// past due and has this agent not run since?", so whichever gets there first
// does the work and the other sees the run and skips. No double-dispatch, and a
// late tick produces a late run instead of a silently missed one.
for (const r of rows) {
  // Continuous watchdogs (Finn, Bo, Vera, Dash) are NOT schedule-driven — owner
  // order 2026-09-03. They are watched over by agent-watchdog.yml, which probes
  // every minute and wakes them only on a real finding. Dispatching them from
  // here too would double-run them, so the clock skips them entirely.
  if (config.agents[r.agent_id]?.continuous) continue;
  const schedule = r.schedule || config.agents[r.agent_id]?.default_schedule;
  if (!schedule) continue;
  const prior = await sb("GET", "agent_runs", {
    params: `agent_id=eq.${r.agent_id}&select=started_at&order=started_at.desc&limit=1`,
  });
  if (!isDue(schedule, prior?.[0]?.started_at ?? null, new Date())) continue;
  const wf = config.agents[r.agent_id]?.workflow;
  if (!wf) continue;
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY ?? "menashharooni-arch/relationship-app"}/actions/workflows/${wf}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json" },
    body: JSON.stringify({ ref: "main", inputs: { trigger: "schedule" } }),
  });
  console.log(`${r.agent_id} (${schedule}${r.schedule ? "" : " default"}) → dispatch ${res.status}`);
}
