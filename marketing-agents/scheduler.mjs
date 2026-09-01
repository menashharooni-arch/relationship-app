// Reads agent_settings.schedule (cron, set from the UI; NULL = manual-only)
// and dispatches the matching workflow for any agent due in this half-hour
// window. With all schedules NULL — the shipped default — this exits having
// done nothing.
import { readFileSync } from "node:fs";
import { sb } from "./lib/agentkit.mjs";

const config = JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8"));
const rows = await sb("GET", "agent_settings", { params: "schedule=not.is.null&enabled=is.true&paused=is.false" });
if (!rows?.length) { console.log("No schedules set — nothing to dispatch."); process.exit(0); }
const sys = (await sb("GET", "agent_system", { params: "limit=1" }))[0];
if (sys.paused) { console.log("System paused — dispatching nothing."); process.exit(0); }

const now = new Date();
const due = (cron) => {
  const [m, h] = cron.trim().split(/\s+/); // supports "M H * * *" (daily at H:M)
  const hit = (f, v) => f === "*" || Number(f) === v;
  return hit(h, now.getUTCHours()) && (m === "*" || Math.abs(Number(m) - now.getUTCMinutes()) < 30);
};
for (const r of rows) {
  if (!due(r.schedule)) continue;
  const wf = config.agents[r.agent_id]?.workflow;
  if (!wf) continue;
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY ?? "menashharooni-arch/relationship-app"}/actions/workflows/${wf}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json" },
    body: JSON.stringify({ ref: "main", inputs: { trigger: "schedule" } }),
  });
  console.log(`${r.agent_id} (${r.schedule}) → dispatch ${res.status}`);
}
