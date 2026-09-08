// ── The company group chat — shared helpers for a chat turn ──────────────────
//
// The owner and every agent are in ONE room (Admin → Agent Flow → Chat). He
// @-mentions who he wants; each mentioned agent takes a "chat turn": a direct
// run that reads the thread, does the work he asked for the way it always
// works (research → two finished options in the queue, a fix request → the
// Fixer's draft PR, an order to a team → delegated to the right colleague),
// and replies in the thread. Everything here writes only agent_* tables.

import { readFileSync } from "node:fs";
import { sb, partyOf } from "./agentkit.mjs";

export const ORG = JSON.parse(readFileSync(new URL("../org.json", import.meta.url), "utf8")).parties;
export const CONFIG = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8"));
const REPO = process.env.GITHUB_REPOSITORY ?? "menashharooni-arch/relationship-app";

/** The party id a responder speaks as ("seo" → "jake", "manager" → "atlas", "maya" → "maya"). */
export function partyOfResponder(responder) {
  return ORG[responder] ? responder : partyOf(responder);
}

/** Resolve a responder id into { agentId, party, kind } or null. */
export function resolveResponder(responder) {
  if (!responder) return null;
  if (CONFIG.agents[responder] && !["fixer"].includes(responder)) {
    const party = partyOf(responder);
    return { agentId: responder, party, kind: ORG[party]?.kind === "chief" ? "chief" : "worker" };
  }
  if (ORG[responder]?.kind === "lead") return { agentId: responder, party: responder, kind: "lead" };
  return null;
}

/** Workers reporting to a lead, as agent_ids. */
export function teamOf(leadParty) {
  return Object.entries(ORG).filter(([, p]) => p.kind === "worker" && p.reports_to === leadParty && p.agent_id).map(([, p]) => p.agent_id);
}

/** Every runnable responder (workers + Atlas) — what Atlas may delegate to. */
export function allWorkers() {
  return Object.values(ORG).filter((p) => p.agent_id && p.kind !== "chief").map((p) => p.agent_id);
}

export const nameOf = (partyId) => ORG[partyId]?.name ?? partyId;
export const roleOf = (partyId) => ORG[partyId]?.role ?? partyId;

// ── Thread & orders ──────────────────────────────────────────────────────────

/** The orders waiting on THIS responder (oldest first), with their messages. */
export async function myOrders(responder) {
  const orders = (await sb("GET", "agent_chat_orders", {
    params: `responder=eq.${responder}&status=in.(waiting,working)&select=*&order=created_at.asc&limit=10`,
  })) ?? [];
  if (!orders.length) return [];
  const ids = orders.map((o) => o.message_id).join(",");
  const msgs = (await sb("GET", "agent_chat", { params: `id=in.(${ids})&select=*` })) ?? [];
  const byId = Object.fromEntries(msgs.map((m) => [m.id, m]));
  return orders.map((o) => ({ ...o, message: byId[o.message_id] })).filter((o) => o.message);
}

export async function setOrders(ids, patch) {
  if (!ids.length) return;
  await sb("PATCH", "agent_chat_orders", { params: `id=in.(${ids.join(",")})`, body: { ...patch, updated_at: new Date().toISOString() } }).catch(() => {});
}

/** The last N messages in the room, oldest first, for context. */
export async function recentThread(limit = 25) {
  const rows = (await sb("GET", "agent_chat", { params: `select=*&order=created_at.desc&limit=${limit}` })) ?? [];
  return rows.reverse();
}

export function threadBlock(msgs, me) {
  if (!msgs.length) return "\n---\nTHE ROOM SO FAR: (empty — this is the first message)";
  const line = (m) => {
    const who = m.from_id === "owner" ? "Menash (OWNER)" : m.from_id === me ? `${nameOf(m.from_id)} (me)` : `${nameOf(m.from_id)} (${roleOf(m.from_id)})`;
    const t = new Date(m.created_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return `[${t}] ${who}${m.kind === "system" ? " [system]" : ""}: ${String(m.body).replace(/\s+/g, " ").slice(0, 900)}`;
  };
  return `\n---\nTHE ROOM SO FAR (oldest first; the owner's messages are the ones that matter — the rest is context):\n${msgs.map(line).join("\n")}`;
}

export function ordersBlock(orders) {
  const lines = orders.map((o) => {
    const m = o.message;
    const who = m.from_id === "owner" ? "the OWNER (Menash)" : `${nameOf(m.from_id)} (${roleOf(m.from_id)}, passing on the owner's order)`;
    return `- From ${who}: “${String(m.body).replace(/\s+/g, " ")}”`;
  });
  return `\n---\nADDRESSED TO ME RIGHT NOW (answer every one of these in ONE reply; do what is asked, do not just promise to):\n${lines.join("\n")}`;
}

/** Post a line into the room. Returns the row. */
export async function post({ from_id, kind = "reply", body, mentions = [], reply_to = null, run_id = null, payload = {} }) {
  const [row] = await sb("POST", "agent_chat", {
    body: { from_id, kind, body: String(body).slice(0, 8000), mentions, reply_to, run_id, payload },
    prefer: "return=representation",
  });
  return row;
}

/** Best-effort system line (never throws). */
export async function systemLine(body, reply_to = null) {
  try { await post({ from_id: "atlas", kind: "system", body, reply_to }); } catch { /* best-effort */ }
}

// ── Waking colleagues ────────────────────────────────────────────────────────

async function dispatchWorkflow(workflow, inputs) {
  if (!process.env.GH_TOKEN) { console.log(`  ! GH_TOKEN missing — cannot dispatch ${workflow}`); return false; }
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json" },
    body: JSON.stringify({ ref: "main", inputs }),
  }).catch(() => null);
  if (res?.status !== 204) console.log(`  ! dispatch ${workflow} → ${res?.status ?? "network"}`);
  return res?.status === 204;
}

/** Wake a colleague's chat turn (their orders are already in the table). */
export function dispatchChatTurn(responder) { return dispatchWorkflow("agent-chat.yml", { agent: responder, trigger: "chat" }); }

/** Hand a queued finding to the Fixer (draft PR only — it cannot merge). */
export function dispatchFixer(itemId) { return dispatchWorkflow("agent-fixer.yml", { item_id: itemId }); }

/** Start an agent's normal full run now ("run_now"). */
export function dispatchFullRun(agentId) {
  const wf = CONFIG.agents[agentId]?.workflow;
  if (!wf) return Promise.resolve(false);
  // bugwatch's triage workflow takes no trigger input; every agent-*.yml does.
  return dispatchWorkflow(wf, wf.startsWith("agent-") ? { trigger: "manual" } : {});
}

/** Give a colleague an order in the room and wake them. Returns the message row. */
export async function delegate({ from, to, order, reply_to, run_id }) {
  const responder = resolveResponder(to);
  if (!responder) return null;
  const toParty = responder.party;
  const row = await post({ from_id: from, kind: "message", body: `@${nameOf(toParty)} ${order}`, mentions: [responder.agentId], reply_to, run_id });
  await sb("POST", "agent_chat_orders", { body: { message_id: row.id, responder: responder.agentId } });
  await dispatchChatTurn(responder.agentId);
  return row;
}

// ── Context blocks ───────────────────────────────────────────────────────────

/** How this agent is switched right now — so it can say "I'm benched" honestly. */
export async function switchState(agentId) {
  try {
    const [row] = await sb("GET", "agent_settings", { params: `agent_id=eq.${agentId}&select=enabled,paused,schedule&limit=1` }) ?? [];
    const sys = (await sb("GET", "agent_system", { params: "select=paused,auto_pause_at&limit=1" }))?.[0];
    const parts = [];
    if (row) parts.push(row.enabled ? "I am Active" : "I am BENCHED (Active is off — my scheduled runs do not happen; the owner can tick Active in Settings)");
    if (row?.paused) parts.push("I am paused");
    if (row?.schedule) parts.push(`my rhythm is ${row.schedule}`);
    if (sys?.paused) parts.push("the whole office is on Pause All (only chat turns run)");
    return parts.length ? `\n---\nMY SWITCHES: ${parts.join("; ")}.` : "";
  } catch { return ""; }
}

/** This agent's queue: what is waiting on the owner and what he decided lately. */
export async function myQueueBlock(agentId) {
  try {
    const rows = (await sb("GET", "agent_queue_items", { params: `agent_id=eq.${agentId}&select=title,status,item_type,created_at,payload&order=created_at.desc&limit=15` })) ?? [];
    if (!rows.length) return "\n---\nMY QUEUE: nothing queued yet.";
    const lines = rows.map((r) => `- ${r.created_at.slice(0, 10)} [${r.status}${r.payload?.pr_url ? ", draft PR " + r.payload.pr_url : ""}] ${r.title}`);
    return `\n---\nMY QUEUE (latest 15 — "pending" = waiting on the owner's pick):\n${lines.join("\n")}`;
  } catch { return ""; }
}

export async function lastRunBlock(agentId) {
  try {
    const rows = (await sb("GET", "agent_runs", { params: `agent_id=eq.${agentId}&trigger=neq.chat&select=status,summary,started_at,output_count,usage_tokens&order=started_at.desc&limit=3` })) ?? [];
    if (!rows.length) return "\n---\nMY RECENT RUNS: none yet.";
    const lines = rows.map((r) => `- ${r.started_at.slice(0, 16).replace("T", " ")} UTC · ${r.status} · ${r.output_count ?? 0} item(s) · ${String(r.summary ?? "").replace(/\s+/g, " ").slice(0, 200)}`);
    return `\n---\nMY RECENT RUNS:\n${lines.join("\n")}`;
  } catch { return ""; }
}

/** The whole company at a glance — for Atlas (and, narrowed, for a lead). */
export async function companyBlock({ onlyAgents = null } = {}) {
  try {
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const since = new Date(Date.now() - 48 * 3600e3).toISOString();
    const [settings, runs, pending, monthRuns, sysRows] = await Promise.all([
      sb("GET", "agent_settings", { params: "select=agent_id,enabled,paused,schedule" }),
      sb("GET", "agent_runs", { params: `started_at=gte.${since}&trigger=neq.chat&select=agent_id,status,summary,started_at,output_count&order=started_at.desc&limit=200` }),
      sb("GET", "agent_queue_items", { params: "status=eq.pending&select=agent_id,item_type" }),
      sb("GET", "agent_runs", { params: `started_at=gte.${monthStart.toISOString()}&select=agent_id,usage_tokens` }),
      sb("GET", "agent_system", { params: "select=paused,auto_pause_at,monthly_usage_cap_tokens&limit=1" }),
    ]);
    const sys = sysRows?.[0] ?? {};
    const latest = {}; for (const r of runs ?? []) if (!latest[r.agent_id]) latest[r.agent_id] = r;
    const pendingBy = {}; for (const q of pending ?? []) pendingBy[q.agent_id] = (pendingBy[q.agent_id] ?? 0) + 1;
    let month = 0; for (const r of monthRuns ?? []) month += Number(r.usage_tokens ?? 0);
    const ids = (onlyAgents ?? Object.keys(CONFIG.agents).filter((id) => id !== "fixer"));
    const setBy = Object.fromEntries((settings ?? []).map((s) => [s.agent_id, s]));
    const lines = ids.map((id) => {
      const p = ORG[partyOf(id)] ?? {}; const s = setBy[id]; const l = latest[id];
      const sw = !s ? "no settings row" : !s.enabled ? "BENCHED" : s.paused ? "paused" : "active";
      const last = l ? `last run ${l.started_at.slice(0, 16).replace("T", " ")} UTC ${l.status}${l.output_count ? ` (${l.output_count} items)` : ""}: ${String(l.summary ?? "").replace(/\s+/g, " ").slice(0, 120)}` : "no run in 48h";
      return `- ${p.name ?? id} (${p.role ?? id}, agent_id ${id}) · ${sw} · ${pendingBy[id] ?? 0} pending for the owner · ${last}`;
    });
    const cap = Number(sys.monthly_usage_cap_tokens ?? 6_000_000);
    return `\n---\nTHE COMPANY RIGHT NOW (${sys.paused ? "office is on PAUSE ALL" : "office open"}; ${Math.round(month / 1e3)}k of the ${Math.round(cap / 1e6)}M-token monthly cap used):\n${lines.join("\n")}`;
  } catch { return ""; }
}

/** A live probe for the four watchdogs — real numbers, not memory. */
export async function probeBlock(agentId) {
  try {
    const { DETECTORS, blindnessFindings } = await import("./detectors.mjs");
    if (!DETECTORS[agentId]) return "";
    const findings = [...(await blindnessFindings(agentId)), ...(await DETECTORS[agentId]())];
    if (!findings.length) return "\n---\nLIVE PROBE (I just ran my checks against production): all clear — nothing tripped.";
    return `\n---\nLIVE PROBE (I just ran my checks against production):\n${findings.map((f) => `- ${f.severity}: ${f.title} — ${String(f.detail ?? "").slice(0, 300)}`).join("\n")}`;
  } catch (e) { return `\n---\nLIVE PROBE: my checks threw an error (${String(e?.message ?? e).slice(0, 160)}) — say so.`; }
}
