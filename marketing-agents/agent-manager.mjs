// ── Agent 10: Manager / Digest — reads everything, owns nothing ──────────────
// Compiles the latest run of every agent + queue counts + month usage + trend
// numbers into ONE report: a queue item (shown in the tab) and an email.
import { safeMain, sb, email } from "./lib/agentkit.mjs";

const AGENTS = ["outreach", "prospects", "seo", "blog", "social", "mentions", "influencer", "bugwatch", "security"];

await safeMain("manager", async (run) => {
  await run.note("Compiling digest…");
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);

  const [runs, pending, monthRuns, criticalItems] = await Promise.all([
    sb("GET", "agent_runs", { params: `started_at=gte.${since}&order=started_at.desc` }),
    sb("GET", "agent_queue_items", { params: "status=eq.pending&select=agent_id,item_type" }),
    sb("GET", "agent_runs", { params: `started_at=gte.${monthStart.toISOString()}&select=agent_id,usage_usd` }),
    sb("GET", "agent_queue_items", { params: "status=eq.pending&item_type=eq.security_finding&select=title" }),
  ]);
  const sys = (await sb("GET", "agent_system", { params: "limit=1" }))[0];

  const latest = {}; for (const r of runs ?? []) if (!latest[r.agent_id]) latest[r.agent_id] = r;
  const pendingBy = {}; for (const q of pending ?? []) pendingBy[q.agent_id] = (pendingBy[q.agent_id] ?? 0) + 1;
  const spendBy = {}; let monthSpend = 0;
  for (const r of monthRuns ?? []) { spendBy[r.agent_id] = (spendBy[r.agent_id] ?? 0) + Number(r.usage_usd); monthSpend += Number(r.usage_usd); }

  // Trends — READ-ONLY peeks at product data, exactly what the digest spec asks for.
  const d7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const count = async (table, params) => { try { const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, Prefer: "count=exact", Range: "0-0" } }); return Number((r.headers.get("content-range") ?? "/0").split("/")[1]); } catch { return null; } };
  const [signups7, leads7, errors24] = await Promise.all([
    count("profiles", `created_at=gte.${d7}&select=id`),
    count("leads", `created_at=gte.${d7}&select=id`),
    count("agent_queue_items", `item_type=eq.security_finding&created_at=gte.${since}&select=id`),
  ]);

  const failed = AGENTS.filter((a) => latest[a]?.status === "failed");
  const silent = AGENTS.filter((a) => !latest[a]);
  const totalPending = Object.values(pendingBy).reduce((s, n) => s + n, 0);

  const lines = [];
  if (criticalItems?.length) lines.push(`🔴 CRITICAL — ${criticalItems.length} security finding(s) pending: ${criticalItems.slice(0, 3).map((c) => c.title).join(" · ")}`);
  if (failed.length) lines.push(`🔴 FAILED agents: ${failed.join(", ")}`);
  lines.push("", "PER AGENT (last 24h):");
  for (const a of AGENTS) {
    const r = latest[a];
    lines.push(`  ${a.padEnd(11)} ${r ? `${r.status.padEnd(8)} ${r.output_count} item(s), $${Number(r.usage_usd).toFixed(2)} — ${String(r.summary ?? "").slice(0, 90)}` : "did not run"}`);
  }
  lines.push("", `AWAITING YOUR REVIEW: ${totalPending} item(s) → swiftcard.me/admin/agent-flow`);
  lines.push("", `USAGE this month: $${monthSpend.toFixed(2)} of $${sys.monthly_usage_cap_usd} cap` , ...AGENTS.filter((a) => spendBy[a]).map((a) => `  ${a}: $${spendBy[a].toFixed(2)}`));
  lines.push("", "TRENDS (7d):", `  new signups: ${signups7 ?? "?"}`, `  leads captured: ${leads7 ?? "?"}`, `  security findings (24h): ${errors24 ?? 0}`, "  keyword movement / blog traffic: Google Search Console + Admin → Website");
  if (silent.length) lines.push("", `Not run in 24h (fine if you didn't trigger them): ${silent.join(", ")}`);

  const report = lines.join("\n");
  await run.addItem({ item_type: "digest", platform: "site", target: "daily digest", title: `Digest ${new Date().toISOString().slice(0, 10)} — ${totalPending} pending, $${monthSpend.toFixed(2)} spent`, content: report, context: "Compiled from agent_runs + queue + product counts (read-only)." });
  await email(`Agent Flow digest — ${totalPending} pending${criticalItems?.length ? " · 🔴 CRITICAL" : ""}`, `<pre style="font:13px/1.5 ui-monospace,monospace">${report.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`);
  await run.finish("success", `Digest compiled: ${totalPending} pending, $${monthSpend.toFixed(2)} month spend.`);
});
