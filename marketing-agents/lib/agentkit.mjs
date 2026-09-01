// ── Shared runtime for every marketing/monitoring agent ──────────────────────
//
// Plain Node (24+), zero dependencies — runs in GitHub Actions with nothing but
// `node`. Talks to Supabase over REST with the service-role key.
//
// THE SAFETY CONTRACT every agent inherits by using this file:
//   • Its ONLY write surface is the agent_* tables. There is no helper here for
//     touching product tables, and no platform (Reddit/IG/X/LinkedIn) API of
//     any kind — draft-only agents are structurally unable to post.
//   • Fail safe: safeMain() wraps the run; any throw marks the run failed with
//     the error and exits nonzero. Queue writes are single INSERTs — there is
//     no multi-step write that can be left half-done.
//   • Pause: checkpoint() re-reads the pause flags between steps. A pause
//     takes effect at the next checkpoint — finished items stay, the run is
//     marked 'paused' with a summary of what it got through.
//   • Caps: assertRunnable() refuses to start when the agent is disabled or
//     paused, and when this month's total spend has hit the system cap — in
//     which case it emails the owner instead of silently burning capacity.

const SB_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY || "";

function need(name, v) { if (!v) throw new Error(`${name} is not set`); return v; }

export async function sb(method, path, { params = "", body, prefer } = {}) {
  const url = `${need("SUPABASE_URL", SB_URL)}/rest/v1/${path}${params ? `?${params}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: need("SUPABASE_SERVICE_ROLE_KEY", SB_KEY),
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`supabase ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export async function getSettings(agentId) {
  const rows = await sb("GET", "agent_settings", { params: `agent_id=eq.${agentId}&limit=1` });
  if (!rows?.length) throw new Error(`no agent_settings row for '${agentId}' — has supabase/agent-flow.sql been run?`);
  return rows[0];
}

export async function getSystem() {
  const rows = await sb("GET", "agent_system", { params: "limit=1" });
  if (!rows?.length) throw new Error("agent_system row missing — run supabase/agent-flow.sql");
  return rows[0];
}

async function monthSpendUsd() {
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const rows = await sb("GET", "agent_runs", {
    params: `select=usage_usd&started_at=gte.${monthStart.toISOString()}`,
  });
  return (rows ?? []).reduce((s, r) => s + Number(r.usage_usd || 0), 0);
}

export async function email(subject, html) {
  if (!RESEND_KEY) { console.log(`[email skipped — no RESEND_API_KEY] ${subject}`); return false; }
  const sys = await getSystem();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "SwiftCard Agents <hello@swiftcard.me>", to: [sys.digest_email], subject, html }),
  });
  if (!res.ok) console.error(`resend → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.ok;
}

/** A run handle. Create with startRun(); everything else hangs off it. */
export class Run {
  constructor(agentId, row, settings) { this.agentId = agentId; this.id = row.id; this.settings = settings; this.outputCount = 0; this.usageUsd = 0; this.usageTokens = 0; this.notes = []; this.finished = false; }

  /** Refuse-to-start gates. Returns null (and records why) instead of a Run when blocked. */
  static async start(agentId, trigger = "manual") {
    const [settings, system] = await Promise.all([getSettings(agentId), getSystem()]);
    const blocked =
      !settings.enabled ? "skipped_disabled" :
      (settings.paused || system.paused) ? "paused" : null;
    if (!blocked) {
      const spent = await monthSpendUsd();
      if (spent >= Number(system.monthly_usage_cap_usd)) {
        const [row] = await sb("POST", "agent_runs", { body: { agent_id: agentId, trigger, status: "skipped_cap", finished_at: new Date().toISOString(), summary: `Monthly usage cap hit ($${spent.toFixed(2)} of $${system.monthly_usage_cap_usd}). Agent did not run.` }, prefer: "return=representation" });
        await email(`Agent Flow: usage cap hit — ${agentId} did not run`, `<p>The system has spent $${spent.toFixed(2)} of its $${system.monthly_usage_cap_usd} monthly cap, so <b>${agentId}</b> refused to start. Raise the cap in the Agent Flow tab if this is intentional.</p>`);
        console.log(`::warning::${agentId}: monthly usage cap hit — not running`);
        return null;
      }
      const [row] = await sb("POST", "agent_runs", { body: { agent_id: agentId, trigger, gh_run_id: process.env.GITHUB_RUN_ID ?? null }, prefer: "return=representation" });
      return new Run(agentId, row, settings);
    }
    await sb("POST", "agent_runs", { body: { agent_id: agentId, trigger, status: blocked, finished_at: new Date().toISOString(), summary: blocked === "paused" ? "Agent (or the whole system) is paused — did not start." : "Agent is disabled — did not start." } });
    console.log(`${agentId}: ${blocked} — not running`);
    return null;
  }

  /** Progress note, visible live in the Agent Flow status board. */
  async note(text) {
    this.notes.push(text);
    console.log(`[${this.agentId}] ${text}`);
    await sb("PATCH", "agent_runs", { params: `id=eq.${this.id}`, body: { summary: text } }).catch(() => {});
  }

  /** Pause gate — call between steps. Exits cleanly if paused (no partial writes: items already inserted stay, nothing is half-written). */
  async checkpoint() {
    const [settings, system] = await Promise.all([getSettings(this.agentId), getSystem()]);
    if (settings.paused || system.paused) {
      await this.finish("paused", `Paused mid-run after: ${this.notes.at(-1) ?? "startup"}. ${this.outputCount} item(s) were completed and kept.`);
      process.exit(0);
    }
    if (this.usageUsd >= Number(this.settings.usage_cap_usd)) {
      await this.finish("success", `Stopped at the per-run usage cap ($${this.settings.usage_cap_usd}). ${this.outputCount} item(s) produced.`);
      process.exit(0);
    }
  }

  addUsage(usd, tokens = 0) { this.usageUsd += Number(usd || 0); this.usageTokens += Number(tokens || 0); }

  /** Queue an item for review. Respects the per-run output cap; dedupes on (agent, dedupe_key). Returns 'added' | 'duplicate' | 'cap'. */
  async addItem({ item_type, title, content = null, context = null, platform = null, target = null, target_url = null, payload = null, dedupe_key = null }) {
    if (this.outputCount >= this.settings.output_cap) return "cap";
    try {
      await sb("POST", "agent_queue_items", { body: { agent_id: this.agentId, run_id: this.id, item_type, title, content, context, platform, target, target_url, payload, dedupe_key } });
      this.outputCount++;
      return "added";
    } catch (e) {
      if (String(e).includes("23505") || String(e).includes("duplicate")) return "duplicate";
      throw e;
    }
  }

  async finish(status, summary) {
    if (this.finished) return; this.finished = true;
    await sb("PATCH", "agent_runs", { params: `id=eq.${this.id}`, body: { status, summary, finished_at: new Date().toISOString(), output_count: this.outputCount, usage_usd: this.usageUsd.toFixed(4), usage_tokens: this.usageTokens } });
  }
}

/** Wrap an agent's main. Guarantees the run row never stays 'running' forever. */
export async function safeMain(agentId, fn) {
  const trigger = process.env.AGENT_TRIGGER || "manual";
  const run = await Run.start(agentId, trigger);
  if (!run) return;
  try {
    await fn(run);
    if (!run.finished) await run.finish("success", `${run.outputCount} item(s) produced. ${run.notes.at(-1) ?? ""}`.trim());
  } catch (e) {
    console.error(e);
    await run.finish("failed", `Failed: ${String(e).slice(0, 400)}`).catch(() => {});
    process.exitCode = 1;
  }
}

/** Parse `claude -p --output-format json` output: returns {text, costUsd, tokens}. */
export function parseClaudeJson(stdout) {
  const j = JSON.parse(stdout);
  const text = j.result ?? "";
  const costUsd = j.total_cost_usd ?? j.cost_usd ?? 0;
  const usage = j.usage ?? {};
  const tokens = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
  return { text, costUsd, tokens };
}

/** Pull the first JSON array/object out of an LLM reply (tolerates prose around it). */
export function extractJson(text) {
  const m = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (!m) throw new Error("no JSON found in model output");
  return JSON.parse(m[1]);
}
