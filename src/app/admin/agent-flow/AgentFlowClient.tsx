"use client";

import { useCallback, useEffect, useState } from "react";
import { ORG, firstName } from "@/lib/agent-org";

// ── Agent Flow v3: one switch, three teams, zero ambiguity ──────────────────
// The owner's mental model, implemented literally: press ▶ Start All and the
// company is OPEN — every agent works on its own cadence (watchdogs every few
// hours, content a few pieces a day) until ⏸ Pause All, the auto-stop timer,
// or the budget cap closes it. The big banner + per-agent "next run in …"
// make on/off unmistakable. Rows wrap downward — nothing ever cuts off.

type Settings = { agent_id: string; enabled: boolean; paused: boolean; output_cap: number; usage_cap_tokens?: number; schedule: string | null };
type RunRow = { id: string; agent_id: string; status: string; started_at: string; finished_at: string | null; output_count: number; usage_usd: number; usage_tokens?: number; summary: string | null; trigger: string };
type UsageWindow = { utilization: number; resets_at: string | null } | null;
type PlanUsage = { source: "live" | "snapshot" | "none"; five_hour?: UsageWindow; seven_day?: UsageWindow; captured_at?: string };
type Item = { id: string; agent_id: string; item_type: string; platform: string | null; target: string | null; target_url: string | null; title: string; content: string | null; context: string | null; status: string; payload: Record<string, unknown> | null; created_at: string };
type Board = { ready: boolean; message?: string; settings: Settings[]; system: { paused: boolean; monthly_usage_cap_tokens?: number; digest_email: string; auto_pause_at: string | null }; latestRuns: Record<string, RunRow>; recentRuns: RunRow[]; pendingBy: Record<string, number>; pendingTotal: number; spendBy: Record<string, number>; dispatchConfigured: boolean; connectors?: Record<string, boolean>; tokensBy?: Record<string, number> };

/** 12,345 → "12.3k", 1,234,567 → "1.23M". */
function fmtTok(n: number | undefined | null): string {
  const v = Number(n ?? 0);
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1000) return `${(v / 1e3).toFixed(1)}k`;
  return String(Math.round(v));
}

// Mirrors src/lib/agent-execute.ts matching rules (armed-ness comes from the
// board payload — the client never sees tokens). Kept in sync by tests.
const CONNECTOR_RULES: Array<{ id: string; label: string; matches: (i: Item) => boolean }> = [
  { id: "linkedin", label: "Post to LinkedIn", matches: (i) => i.platform === "linkedin" && ["generic", "video_script", "blog_post"].includes(i.item_type) },
  { id: "higgsfield", label: "Send to Higgsfield", matches: (i) => i.item_type === "video_script" && i.platform !== "linkedin" },
  { id: "reddit", label: "Reply on Reddit", matches: (i) => i.platform === "reddit" && ["reply_draft", "outreach_draft"].includes(i.item_type) && !!i.target_url },
];
const CONNECTOR_ENVS: Record<string, string> = {
  linkedin: "LINKEDIN_ACCESS_TOKEN + LINKEDIN_AUTHOR_URN",
  higgsfield: "HIGGSFIELD_API_KEY_ID + HIGGSFIELD_API_KEY_SECRET",
  reddit: "REDDIT_CLIENT_ID + SECRET + USERNAME + PASSWORD",
};

// Personas come from marketing-agents/org.json (one source of truth with the
// runners). AGENT_NAMES keys stay the runnable agent_ids the DB uses.
const AGENT_NAMES: Record<string, string> = Object.fromEntries(
  Object.values(ORG).filter((p) => p.agent_id).map((p) => [p.agent_id!, `${p.emoji} ${p.name} · ${p.role}`]),
);
const AGENT_ROLE: Record<string, string> = {
  outreach: "finds people + drafts your messages", prospects: "builds your prospect CSVs",
  seo: "keeps the site rankable", blog: "writes posts for your review",
  social: "a few videos & captions a day", mentions: "drafts replies to live threads",
  influencer: "scouts creators + drafts pitches", bugwatch: "turns errors into draft fixes",
  security: "vulns, leaks, headers", perf: "keeps everything fast",
  flowcheck: "walks the user journeys end-to-end", manager: "runs the company, reports to you",
};
const TEAMS: { id: string; label: string; blurb: string; agents: string[]; lead?: string }[] = [
  { id: "manager", label: "🧠 Atlas — Chief of Staff", blurb: "Runs the company, reads everything, reports to you.", agents: ["manager"] },
  { id: "marketing", label: "📣 Maya's Marketing team", blurb: "SEO, content, outreach — fills your queue with work to approve.", agents: ["seo", "blog", "social", "outreach", "prospects", "mentions", "influencer"], lead: "maya" },
  { id: "protection", label: "🛠️ Rex's Engineering team", blurb: "Speed, bugs, breaches, broken flows — watches the product around the clock.", agents: ["perf", "flowcheck", "security", "bugwatch"], lead: "rex" },
];
const TYPE_LABEL: Record<string, string> = {
  outreach_draft: "Outreach draft", prospect: "Prospect", reply_draft: "Reply draft", influencer: "Influencer pitch",
  video_script: "Video script", blog_post: "Blog post", seo_report: "SEO report", security_finding: "Security finding",
  perf_report: "Speed report", flow_finding: "Flow finding", digest: "Report", generic: "Post draft",
};

function ago(iso: string | null) {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
function dur(a: string, b: string | null, now?: number): string {
  const sec = Math.max(0, Math.floor(((b ? new Date(b).getTime() : (now ?? Date.now())) - new Date(a).getTime()) / 1000));
  return sec < 90 ? `${sec}s` : `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s`;
}
function untilText(iso: string, now: number): string {
  const m = Math.ceil((new Date(iso).getTime() - now) / 60000);
  if (m <= 0) return "now";
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
/** New-York wall clock (the cadences are set in ET). */
function nyNow(now: number): { h: number; m: number } {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date(now));
  return { h: Number(p.find((x) => x.type === "hour")!.value) % 24, m: Number(p.find((x) => x.type === "minute")!.value) };
}
// Every agent works a rhythm (owner order 2026-09-02): an empty schedule
// means the agent's default_schedule from marketing-agents/config.json — the
// scheduler falls back to the same map, so this display never lies. "Manual
// only" is not a state; the Active toggle is the one per-agent switch.
const DEFAULT_SCHEDULES: Record<string, string> = {
  outreach: "every@8h", prospects: "daily@07:30", seo: "every@8h", blog: "daily@09:30",
  social: "every@8h", mentions: "every@8h", influencer: "daily@12:00", ads: "daily@10:00",
  manager: "daily@12:00,17:00",
};
// The watch. Owner order 2026-09-03: these four have NO schedule and no "next
// check" — they watch continuously while the office is open and their Active
// box is ticked, and only the owner stops them. Showing a countdown here was
// actively misleading: it read as "something is watching" during hours when
// nothing was. Keep this in step with `continuous: true` in
// marketing-agents/config.json (tests/agent-flow.test.ts pins the pair).
const CONTINUOUS = new Set(["flowcheck", "bugwatch", "security", "perf"]);
/** "in ~2h 10m" until this agent's next scheduled run. */
function nextRunText(rawSchedule: string | null, agentId: string, now: number): string | null {
  // Watchdogs never have a "next run" — they are already running. Returning a
  // countdown for one is how the board came to claim a watch that wasn't there.
  if (CONTINUOUS.has(agentId)) return null;
  const schedule = rawSchedule || DEFAULT_SCHEDULES[agentId] || null;
  if (!schedule) return null;
  const { h, m } = nyNow(now);
  const minsNow = h * 60 + m;
  let target: number | null = null;
  const every = schedule.match(/^every@(\d{1,2})h$/);
  if (every) { const n = Number(every[1]); const nextH = (Math.floor(h / n) + 1) * n; target = (nextH % 24) * 60; if (nextH >= 24) target += 24 * 60; if (h % n === 0 && m < 30) return "running window now"; }
  const daily = schedule.match(/^daily@(\d{1,2}):(\d{2})$/);
  if (daily) { target = Number(daily[1]) * 60 + Number(daily[2]); if (target <= minsNow) target += 24 * 60; }
  if (target === null) return null;
  const diff = target - minsNow;
  if (diff <= 0) return "running window now";
  return diff < 60 ? `in ~${diff}m` : `in ~${Math.floor(diff / 60)}h ${String(diff % 60).padStart(2, "0")}m`;
}
function etToday(hour: number, minute = 0): string {
  const now = new Date();
  const { h, m } = nyNow(now.getTime());
  const offsetMin = (h * 60 + m) - (now.getUTCHours() * 60 + now.getUTCMinutes());
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute));
  return new Date(target.getTime() - offsetMin * 60000).toISOString();
}

const CADENCES: [string, string][] = [
  ["", "default rhythm"],
  ["every@4h", "every 4 hours"],
  ["every@8h", "every 8 hours"],
  ["every@12h", "twice a day"],
  ["daily@07:30", "daily · 7:30 AM ET"],
  ["daily@09:30", "daily · 9:30 AM ET"],
  ["daily@12:00", "daily · noon ET"],
  ["daily@17:30", "daily · 5:30 PM ET"],
  ["daily@12:00,17:00", "twice daily · noon + 5 PM ET"],
];

type Msg = { id: string; from_id: string; to_id: string; kind: string; body: string; run_id: string | null; created_at: string };
type View = "agents" | "chart" | "comms" | "queue" | "history" | "settings";
type TourStep = { view?: View; target?: string; title: string; body: string };
const TOUR: TourStep[] = [
  { title: "Welcome to Agent Flow", body: "Your workforce. Press Start to OPEN the office — nothing runs yet; every team waits at rest. Wake a team and its agents start working on their own rhythms — a few pieces of content a day, watchdogs every few hours — until you Rest the team, press Pause, your auto-stop time hits, or the monthly token budget stops it. Nothing is ever sent to another platform without you." },
  { view: "agents", target: "master", title: "The one switch", body: "Green Start = the office is OPEN — but every team starts at rest, so nothing runs until you wake a team below. Press Pause and everything stops at its next safe checkpoint. The banner beside it always tells you which state you're in." },
  { view: "agents", target: "autostop", title: "Auto-stop — your closing time", body: "Optional clock-out: 'stop at 5 PM' or 'stop in 3 hours'. When it hits, the whole system pauses itself until you Start it again." },
  { view: "agents", target: "team-marketing", title: "Your teams", body: "Atlas is your chief of staff — he runs the company and reports only to you. Maya leads Marketing (Jake on SEO, Nora on the blog, Milo on social, Ava on outreach, Leo on prospects, Zoe on mentions, Ivy on influencers). Rex leads Engineering (Dash on speed, Finn on user flows, Vera on security, Bo on bugs) — their findings arrive with fixes already drafted." },
  { view: "chart", target: "orgchart", title: "The org chart", body: "Your company, live. Blue pulse = working right now (the reporting line animates too), red = a problem, gray = benched. Click anyone to read their messages." },
  { view: "comms", target: "comms", title: "Communications", body: "The company chat log. Your orders (👑), dispatches down the chain (Maya → Jake: GO), report-backs (Jake → Maya: Done — 4 items, $0.40), and escalations to Atlas when something fails. Every row is a real event, written the moment it happened." },
  { view: "agents", target: "agentrow", title: "One worker, one row", body: "Each row: what they do, whether they're working right now (a live timer counts), when their next shift starts, and their last result. 'Run once' fires them immediately regardless of schedule; the Active toggle benches them; ▾ log is their full diary." },
  { view: "queue", target: "tabs", title: "The Review queue", body: "Everything your agents produce waits here for your call. The badge on the tab shows how many. Approving never posts anything anywhere — you stay the sender." },
  { view: "queue", target: "checkbox", title: "Handling a pile at once", body: "Tick several items (or Select all shown) and a bar appears to approve or reject them together. Approve = 'good, mine to use'. Reject = filed away forever, nothing deleted." },
  { view: "history", target: "historylist", title: "History", body: "Every decision you've made, as sentences. For outreach you sent, record 'Got a reply' or 'Converted' here — that's how you learn which agents earn their keep." },
  { view: "settings", target: "settingslist", title: "Settings", body: "Per agent: on/off, items per run, token budget per run, and their working rhythm. The monthly cap at the top is the hard ceiling — agents stop rather than pass it (logged in comms and the evening report; no email)." },
  { title: "That's it", body: "Press Start, wake the teams you want working, live your day, and come back to the badge and Atlas's evening report. Replay this anytime with ✦ Take a tour." },
];

export default function AgentFlowClient() {
  const [board, setBoard] = useState<Board | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [view, setView] = useState<View>("agents");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [commsKind, setCommsKind] = useState("");
  const [commsParty, setCommsParty] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [history, setHistory] = useState<Array<{ id: string; item_id: string | null; action: string; actor_email: string; created_at: string; outcome: string | null; agent_queue_items: { agent_id: string; item_type: string; title: string; status: string } | null }>>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [autoStopOpen, setAutoStopOpen] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [tourRect, setTourRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);
  const [usageBusy, setUsageBusy] = useState(false);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 4200); };
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Claude-plan usage meter: on load + manual ↻ + every 60s.
  const loadUsage = useCallback(async () => {
    setUsageBusy(true);
    const u = await fetch("/api/admin/agents/usage").then((r) => r.json()).catch(() => null);
    if (u?.source) setPlanUsage(u);
    setUsageBusy(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + the 60s auto-refresh, same pattern as the board loader
  useEffect(() => { loadUsage(); const t = setInterval(loadUsage, 60000); return () => clearInterval(t); }, [loadUsage]);

  const load = useCallback(async () => {
    setLoading(true);
    const b = await fetch("/api/admin/agents").then((r) => r.json()).catch(() => null);
    setBoard(b);
    if (b?.ready) {
      const q = new URLSearchParams({ status: filterStatus });
      if (filterAgent) q.set("agent", filterAgent);
      if (filterType) q.set("type", filterType);
      const d = await fetch(`/api/admin/agents/items?${q}`).then((r) => r.json()).catch(() => null);
      setItems(d?.items ?? []);
    }
    setLoading(false); setUpdatedAt(Date.now());
  }, [filterAgent, filterType, filterStatus]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + the 30s auto-refresh the spec asks for
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (view === "history") fetch("/api/admin/agents/history").then((r) => r.json()).then((d) => setHistory(d.history ?? [])).catch(() => {}); }, [view, items]);

  // Org chart open = watching live: poll the board every 10s instead of 30 so
  // short watcher runs (9-21s) actually get a WORKING frame on screen.
  useEffect(() => {
    if (view !== "chart") return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [view, load]);

  // Comms feed: fetch on open + every 15s while watching (it's a live log).
  useEffect(() => {
    if (view !== "comms") return;
    const pull = () => {
      const q = new URLSearchParams();
      if (commsKind) q.set("kind", commsKind);
      if (commsParty) q.set("party", commsParty);
      fetch(`/api/admin/agents/comms?${q}`).then((r) => r.json()).then((d) => setMsgs(d.messages ?? [])).catch(() => {});
    };
    pull();
    const t = setInterval(pull, 15000);
    return () => clearInterval(t);
  }, [view, commsKind, commsParty]);

  // Tour spotlight: all state updates happen inside the timeout (DOM sync).
  useEffect(() => {
    const step = tourStep === null ? null : TOUR[tourStep];
    const t = setTimeout(() => {
      if (!step) { setTourRect(null); return; }
      if (step.view && step.view !== view) { setView(step.view); return; }
      const el = step.target ? document.querySelector(`[data-aftour="${step.target}"]`) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        setTourRect({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      } else setTourRect(null);
    }, 180);
    return () => clearTimeout(t);
  }, [tourStep, view]);

  const control = async (op: string, agent_id?: string) => {
    setBusy(true);
    const r = await fetch("/api/admin/agents/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, agent_id }) }).then((r) => r.json()).catch(() => ({ error: "network" }));
    setBusy(false);
    if (r.error) say(`⚠ ${r.error}`);
    else if (op === "start_all") say("You're OPEN — all teams are at rest, so nothing runs yet. Wake a team from its header when you want them working. Atlas still files the evening report.");
    else if (op === "pause_all") say("Paused. In-flight agents stop at their next checkpoint — a session summary was written to your queue.");
    else if (op === "run") say(`${AGENT_NAMES[agent_id!] ?? agent_id} is running now — results land in the queue.`);
    else if (op === "pause_team") say(`${firstName(agent_id!)}'s team is resting — they skip their shifts until you wake them. Everyone else keeps working.`);
    else if (op === "resume_team") say(typeof r.dispatched === "number" && r.dispatched > 0
      ? `${firstName(agent_id!)}'s team is AWAKE — ${r.dispatched} agent(s) dispatched right now, then normal rhythms.`
      : `${firstName(agent_id!)}'s team is set to wake — they work whenever the office is open.`);
    else say("Done.");
    load();
  };
  const ACT_TOAST: Record<string, string> = {
    approved: "Approved — nothing is sent automatically; it's yours to use.",
    rejected: "Rejected — filed to History. Nothing was deleted or sent.",
    acknowledged: "Approved — filed to History. Reports execute nothing; code fixes ship when you merge their PR.",
    published: "Published — live on swiftcard.me/blog right now.",
    contacted: "Marked sent — record 'Got a reply' or 'Converted' when it happens.",
    replied: "Recorded the reply 🎯", converted: "Recorded the conversion 🎉", edited: "Saved your version — still pending with your edit.",
  };
  const act = async (ids: string[], action: string, content?: string) => {
    if (!ids.length) return;
    const r = await fetch("/api/admin/agents/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action, content }) }).then((x) => x.json()).catch(() => null);
    if (!r?.ok) { say("⚠ That didn't save — try again."); return; }
    const ex: Array<{ detail: string }> = r.executed ?? [];
    const exFail: Array<{ reason: string }> = r.execFailed ?? [];
    if (ex.length || exFail.length) {
      const parts = [];
      if (ex.length) parts.push(ex.length === 1 ? `✅ ${ex[0].detail}.` : `✅ ${ex.length} item(s) posted automatically.`);
      if (exFail.length) parts.push(`⚠ ${exFail.length === 1 ? `Couldn't auto-post: ${exFail[0].reason}` : `${exFail.length} couldn't auto-post`} — saved as approved, use Copy.`);
      say(parts.join(" "));
    } else {
      say(ids.length > 1 ? `${ids.length} items ${action}. ${ACT_TOAST[action] ?? ""}` : ACT_TOAST[action] ?? "Done.");
    }
    setSelected(new Set()); setEditing(null); load();
  };
  const saveSetting = async (patch: Record<string, unknown>, note?: string) => {
    const r = await fetch("/api/admin/agents/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).then((x) => x.json()).catch(() => null);
    say(r?.ok ? (note ?? "Saved — live from the next run.") : "⚠ Couldn't save that.");
    load();
  };
  // "✓ Approve & Ship fix" — merges the Fixer's tested draft PR (guardrails
  // live server-side in /ship-fix: agent-fix/* → main only, checks green).
  const shipFix = async (it: Item) => {
    setBusy(true);
    const r = await fetch("/api/admin/agents/ship-fix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: it.id }) }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (r?.merged) say("🚀 Fix approved & shipped — the PR merged and is deploying now. The deploy watchdog stands guard.");
    else if (r?.already) say("That fix already shipped.");
    else say(`⚠ ${r?.error ?? "Couldn't ship the fix — try again."}`);
    load();
  };
  const copyApprove = async (it: Item, label: string) => {
    try { await navigator.clipboard.writeText(it.content ?? ""); say(`Copied — paste it into ${label}. Marked approved.`); } catch { say("Copy failed — select the text by hand."); }
    act([it.id], "approved");
  };
  const downloadCsv = (rows: Item[]) => {
    const cols = ["handle", "display_name", "bio", "link_tool", "followers", "niche"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["instagram_handle,full_name,bio,link_tool,followers,niche,why_fit,profile_url",
      ...rows.map((r) => [...cols.map((c) => esc((r.payload as Record<string, unknown>)?.[c])), esc(r.content), esc(r.target_url)].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `swiftcard-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    act(rows.map((r) => r.id), "csv_downloaded");
    say(`Downloaded ${rows.length} prospects — work the CSV, then Mark contacted.`);
  };

  if (board && !board.ready) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 max-w-2xl">
        <p className="text-white font-bold">Agent Flow isn&apos;t set up yet</p>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">{board.message} Nothing has run and nothing is broken.</p>
        <p className="text-gray-500 text-xs mt-3">One-command setup: <code className="text-gray-300">node scripts/agent-flow-setup.mjs</code></p>
      </div>
    );
  }
  if (!board) return <div className="text-gray-500 text-sm">Loading…</div>;

  const agents = board.settings ?? [];
  const byId = Object.fromEntries(agents.map((s) => [s.agent_id, s]));
  const pendingItems = items.filter((i) => i.status === "pending");
  const pendingProspects = pendingItems.filter((i) => i.item_type === "prospect");
  const monthTokens = Object.values(board.tokensBy ?? {}).reduce((t, n) => t + n, 0);
  const restingTeamNames = TEAMS.filter((t) => t.lead && t.agents.every((a) => byId[a]?.paused)).map((t) => firstName(t.lead!));
  const allTeamsResting = TEAMS.filter((t) => t.lead).every((t) => t.agents.every((a) => byId[a]?.paused));
  const monthlyCapTokens = Number(board.system.monthly_usage_cap_tokens ?? 6_000_000);
  const capPct = Math.min(100, Math.round((monthTokens / (monthlyCapTokens || 1)) * 100));
  const autoStopArmed = !!board.system.auto_pause_at && new Date(board.system.auto_pause_at).getTime() > now;
  const autoStopHit = !!board.system.auto_pause_at && new Date(board.system.auto_pause_at).getTime() <= now;
  const open = !board.system.paused && !autoStopHit;
  const runsByAgent: Record<string, RunRow[]> = {};
  for (const r of board.recentRuns ?? []) (runsByAgent[r.agent_id] ??= []).push(r);
  const lastDigest = (board.recentRuns ?? []).find((r) => r.agent_id === "manager" && r.status === "success");
  const step = tourStep !== null ? TOUR[tourStep] : null;

  const AgentRow = ({ id, isFirst }: { id: string; isFirst: boolean }) => {
    const s = byId[id]; if (!s) return null;
    const r = board.latestRuns[id];
    const running = r?.status === "running";
    const problem = r?.status === "failed";
    const next = open && s.enabled && !s.paused ? nextRunText(s.schedule, id, now) : null;
    return (
      <div data-aftour={isFirst ? "agentrow" : undefined} className={`rounded-xl border p-3.5 min-w-0 overflow-hidden ${problem ? "border-red-800/60 bg-red-950/20" : "border-gray-800 bg-gray-900"}`}>
        {/* line 1 — identity + controls; wraps downward, never clips */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
          <p className="text-white text-sm font-semibold">{AGENT_NAMES[id]}</p>
          {running ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 animate-pulse">Working · {r ? dur(r.started_at, null, now) : ""}</span>
            : problem ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-900/50 text-red-400">Problem</span>
            : !s.enabled ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">Benched</span>
            : s.paused ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-950/60 text-sky-300/80">Resting</span>
            : open && CONTINUOUS.has(id) ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">🟢 Watching · live</span>
            : open && next ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400">On duty · {id === "manager" ? "evening report" : "next check"} {next}</span>
            : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{open ? "On duty" : "Waiting for Start"}</span>}
          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={() => control("run", id)} disabled={busy || !s.enabled} className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-full whitespace-nowrap transition-colors">Run once</button>
            <label className="flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer whitespace-nowrap" title="Off = benched: skipped by team wakes and the schedule — the one per-agent switch">
              <input type="checkbox" checked={s.enabled} onChange={async (e) => {
                const on = e.target.checked;
                await saveSetting({ agent_id: id, enabled: on }, on ? (open && !s.paused ? "Back on the roster — starting a run now." : "Back on the roster.") : "Benched — everything else keeps running.");
                // Turning an agent ON is a go signal (owner order 2026-09-02):
                // if the office is open and their team awake, they start NOW.
                if (on && open && !s.paused) control("run", id);
              }} className="accent-blue-600" /> active
            </label>
            <button data-aftour={isFirst ? "logbtn" : undefined} onClick={() => setExpanded(expanded === id ? null : id)} className="text-xs text-gray-500 hover:text-gray-300 px-1.5 py-1.5 whitespace-nowrap transition-colors">{expanded === id ? "▴" : "▾ log"}</button>
          </div>
        </div>
        {/* line 2 — role + last result; truncates gracefully */}
        <div className="mt-1 text-xs text-gray-500 min-w-0">
          <span className="text-gray-600">{AGENT_ROLE[id]}</span>
          <span className="mx-1.5 text-gray-700">·</span>
          <span>{r ? `last: ${r.status === "success" ? "done" : r.status === "skipped_usage" ? "waited (usage window full)" : r.status} ${ago(r.started_at)}, ${r.output_count} item(s), ${fmtTok(r.usage_tokens)} tok` : "hasn't run yet"}</span>
          {(board.tokensBy?.[id] ?? 0) > 0 && <span className="ml-1.5 text-gray-600">· {fmtTok(board.tokensBy![id])} tok this month</span>}
          {(board.pendingBy[id] ?? 0) > 0 && <button onClick={() => { setView("queue"); setFilterAgent(id); setFilterStatus("pending"); setFilterType(""); }} className="ml-1.5 text-blue-400 hover:underline">{board.pendingBy[id]} waiting for you →</button>}
          {(running || problem) && r?.summary && <p className={`mt-0.5 truncate ${running ? "text-blue-300" : "text-red-400/80"}`}>{running ? "⋯ " : ""}{r.summary}</p>}
        </div>
        {expanded === id && (
          <div className="mt-2 border-t border-gray-800 pt-2 space-y-1">
            {(runsByAgent[id] ?? []).length === 0 && <p className="text-gray-600 text-xs">No runs yet.</p>}
            {(runsByAgent[id] ?? []).slice(0, 10).map((rr) => (
              <div key={rr.id} className="flex flex-wrap items-baseline gap-x-2 text-[11.5px] min-w-0">
                <span className="text-gray-600 tabular-nums shrink-0">{new Date(rr.started_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                <span className={rr.status === "failed" ? "text-red-400 font-semibold" : rr.status === "success" ? "text-emerald-500" : "text-amber-400"}>{rr.status === "success" ? "done" : rr.status}</span>
                <span className="text-gray-500 whitespace-nowrap">{dur(rr.started_at, rr.finished_at)} · {rr.output_count} item(s) · {fmtTok(rr.usage_tokens)} tok</span>
                <span className="text-gray-400 basis-full truncate">{rr.summary}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-24">
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] max-w-[92vw] bg-gray-800 border border-gray-700 text-white text-sm px-4 py-2.5 rounded-2xl shadow-xl text-center">{toast}</div>}

      {/* ── The one switch + unmistakable state ── */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 flex flex-wrap items-center gap-3">
        {open ? (
          <button data-aftour="master" onClick={() => control("pause_all")} disabled={busy} className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold px-6 py-3 rounded-full whitespace-nowrap transition-colors">⏸ Pause All</button>
        ) : (
          <button data-aftour="master" onClick={() => control("start_all")} disabled={busy} title="Opens the office — every team starts at rest until you wake it" className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold px-6 py-3 rounded-full whitespace-nowrap transition-colors">▶ Start All</button>
        )}
        <div className="min-w-[200px] flex-1">
          {open ? (
            allTeamsResting ? (
            <p className="text-sky-300 text-sm font-semibold flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-sky-300 shrink-0" />OPEN — all teams resting; wake a team to put them to work</p>
            ) : (
            <p className="text-emerald-400 text-sm font-semibold flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />RUNNING — awake teams work their own rhythms until you rest them{restingTeamNames.length > 0 && <span className="text-sky-300/80 font-bold text-xs whitespace-nowrap">· {restingTeamNames.join(" & ")}&apos;s team resting</span>}</p>
            )
          ) : (
            <p className="text-gray-400 text-sm font-semibold flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" />{autoStopHit ? "AUTO-STOPPED — your clock-out time passed. Start to reopen." : "PAUSED — nothing runs until you press Start"}</p>
          )}
          <p className="text-gray-600 text-[11px] mt-0.5">{fmtTok(monthTokens)} tokens used this month{capPct >= 85 ? " ⚠ near the budget cap" : ""} · stops by itself at the auto-stop time or the {fmtTok(monthlyCapTokens)}-token monthly budget. {board.pendingTotal > 0 ? `${board.pendingTotal} item(s) waiting for you.` : "Queue is clear."}</p>
        </div>
        {/* Claude-plan usage meter — the agents run on the owner's Claude account */}
        <div data-aftour="usage" className="flex flex-col gap-1 min-w-[190px] max-w-[230px]">
          {!planUsage || planUsage.source === "none" ? (
            <p className="text-[10px] text-gray-600 leading-snug">🧠 Claude usage meter arms after the next agent run (or set CLAUDE_CODE_OAUTH_TOKEN in Vercel for always-live).</p>
          ) : (
            <>
              {([["5-hr window", planUsage.five_hour], ["7-day", planUsage.seven_day]] as const).map(([label, w]) => w && (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="text-[9px] text-gray-500 w-14 shrink-0 text-right">{label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div className={`h-full rounded-full ${w.utilization >= 85 ? "bg-red-500" : w.utilization >= 60 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, w.utilization)}%` }} />
                  </div>
                  <span className={`text-[10px] font-bold tabular-nums w-8 ${w.utilization >= 85 ? "text-red-400" : w.utilization >= 60 ? "text-amber-300" : "text-emerald-400"}`}>{Math.round(w.utilization)}%</span>
                </div>
              ))}
              <p className="text-[9px] text-gray-600 flex items-center gap-1">
                <span>🧠 Claude plan{planUsage.source === "live" ? " · live" : ` · from last run, ${ago(planUsage.captured_at ?? null)}`}{planUsage.five_hour?.resets_at ? ` · resets in ${untilText(planUsage.five_hour.resets_at, now)}` : ""}</span>
                <button onClick={loadUsage} disabled={usageBusy} className="text-gray-500 hover:text-white disabled:opacity-40 transition-colors" title="Refresh usage now">{usageBusy ? "…" : "↻"}</button>
              </p>
            </>
          )}
        </div>
        <div data-aftour="autostop" className="relative">
          <button onClick={() => setAutoStopOpen(!autoStopOpen)} className={`text-xs font-semibold px-3.5 py-2.5 rounded-full border whitespace-nowrap transition-colors ${autoStopArmed ? "bg-amber-950/40 border-amber-700/60 text-amber-300" : "bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200"}`}>
            {autoStopArmed ? `⏰ stops in ${untilText(board.system.auto_pause_at!, now)}` : "⏰ auto-stop"}
          </button>
          {autoStopOpen && (
            <div className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl p-3 space-y-1.5">
              <p className="text-gray-400 text-[11px] leading-snug mb-2">Closing time: when it hits, everything pauses safely until you press Start again.</p>
              {([["Stop in 1 hour", "in1"], ["Stop in 3 hours", "in3"], ["Stop at 5:00 PM ET", "at17"], ["Stop at 8:00 PM ET", "at20"]] as const).map(([label, kind]) => (
                <button key={kind} onClick={() => {
                  const iso = kind === "in1" ? new Date(Date.now() + 3600e3).toISOString() : kind === "in3" ? new Date(Date.now() + 3 * 3600e3).toISOString() : etToday(kind === "at17" ? 17 : 20);
                  saveSetting({ system: { auto_pause_at: iso } }, `Auto-stop armed — ${label.toLowerCase()}.`);
                  setAutoStopOpen(false);
                }} className="w-full text-left text-xs text-gray-200 hover:bg-gray-800 rounded-lg px-3 py-2">{label}</button>
              ))}
              {(autoStopArmed || autoStopHit) && <button onClick={() => { saveSetting({ system: { auto_pause_at: null } }, "Auto-stop cleared."); setAutoStopOpen(false); }} className="w-full text-left text-xs text-red-400 hover:bg-gray-800 rounded-lg px-3 py-2">Turn off auto-stop</button>}
            </div>
          )}
        </div>
      </div>
      {!board.dispatchConfigured && <p className="text-amber-400 text-xs">⚠ Run buttons need GITHUB_AGENTS_TOKEN (see marketing-agents/README.md)</p>}

      {/* ── View tabs ── */}
      <div data-aftour="tabs" className="flex flex-wrap items-center gap-1">
        <button onClick={() => setTourStep(0)} className="px-3 py-1.5 rounded-full text-xs font-semibold text-blue-300 bg-blue-950/40 border border-blue-800/50 hover:bg-blue-900/40 whitespace-nowrap transition-colors">✦ Take a tour</button>
        {([["agents", "Agents"], ["chart", "Org chart"], ["comms", "Comms"], ["queue", "Review queue"], ["history", "History"], ["settings", "Settings"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${view === v ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
            {label}{v === "queue" && board.pendingTotal > 0 ? ` (${board.pendingTotal})` : ""}
          </button>
        ))}
        {view === "queue" && <><button onClick={load} className="text-xs text-gray-400 hover:text-white px-2 py-1.5 transition-colors">{loading ? "↻ updating…" : "↻ Refresh"}</button>{updatedAt && <span className="text-gray-600 text-[10px]">updated {ago(new Date(updatedAt).toISOString())} · auto every 30s</span>}</>}
      </div>

      {view === "agents" && (
        <div className="space-y-5">
          {TEAMS.map((team) => {
            const teamResting = !!team.lead && team.agents.every((id) => byId[id]?.paused);
            return (
            <div key={team.id} data-aftour={`team-${team.id}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <p className="text-white text-[15px] font-bold">{team.label}</p>
                <p className="text-gray-600 text-xs">{team.blurb}</p>
                {team.lead && (
                  <button
                    onClick={() => control(teamResting ? "resume_team" : "pause_team", team.lead)}
                    disabled={busy}
                    title={teamResting ? "Everyone on this team resumes their normal rhythms" : "The whole team stops at its next checkpoint and skips shifts until you wake it — other teams keep working"}
                    className={`ml-auto text-[11px] font-bold px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${teamResting ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/40" : "bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200"}`}
                  >
                    {teamResting ? "▶ Wake team" : "⏸ Rest team"}
                  </button>
                )}
              </div>
              <div className="grid gap-2">
                {team.agents.map((id, i) => <AgentRow key={id} id={id} isFirst={team.id === "marketing" && i === 0} />)}
              </div>
            </div>
          ); })}
          {lastDigest && <p className="text-gray-600 text-xs">Atlas&apos;s last report {ago(lastDigest.started_at)} — <button onClick={() => { setView("queue"); setFilterAgent("manager"); setFilterType("digest"); setFilterStatus("pending"); }} className="text-blue-400 hover:underline">open</button> (also emailed to {board.system.digest_email}).</p>}
        </div>
      )}

      {view === "chart" && (() => {
        // Live org chart, derived from org.json so a re-org redraws itself.
        const statusOf = (agentId?: string): "working" | "problem" | "benched" | "resting" | "fresh" | "idle" => {
          if (!agentId) return "idle";
          const s = byId[agentId];
          if (s && !s.enabled) return "benched";
          const r = board.latestRuns[agentId];
          if (r?.status === "running") return "working";
          if (r?.status === "failed") return "problem";
          if (s?.paused) return "resting";
          // Watcher runs finish in seconds — faster than any poll. A recent
          // success leaves a visible green trace so the chart reflects work
          // that happened between refreshes instead of looking frozen.
          if (r?.status === "success" && r.finished_at && now - new Date(r.finished_at).getTime() < 15 * 60e3) return "fresh";
          return "idle";
        };
        const leads = Object.entries(ORG).filter(([, p]) => p.kind === "lead");
        const workersOf = (lead: string) => Object.entries(ORG).filter(([, p]) => p.kind === "worker" && p.reports_to === lead);
        const leadStatus = (lead: string): ReturnType<typeof statusOf> => {
          const ws = workersOf(lead).map(([, p]) => statusOf(p.agent_id));
          return ws.includes("working") ? "working" : ws.includes("problem") ? "problem" : ws.length && ws.every((s) => s === "resting" || s === "benched") ? "resting" : "idle";
        };
        // Layout: each team gets a horizontal territory wide enough for its
        // widest worker row, so nothing can ever overlap or leave the canvas.
        const NW = 156, NH = 68, GAP = 24, TEAMGAP = 64, M = 28;
        const perRowOf = (n: number) => (n > 4 ? Math.ceil(n / Math.ceil(n / 4)) : n);
        const spanOf = (n: number) => { const per = Math.min(perRowOf(n), n); return per * NW + (per - 1) * GAP; };
        const pos: Record<string, { x: number; y: number }> = {};
        let cursor = M;
        for (const [pid] of leads) {
          const span = Math.max(NW, spanOf(workersOf(pid).length));
          pos[pid] = { x: cursor + span / 2, y: 306 };
          cursor += span + TEAMGAP;
        }
        const W = cursor - TEAMGAP + M;
        pos.owner = { x: W / 2, y: 48 };
        pos.atlas = { x: W / 2, y: 176 };
        let H = 480;
        for (const [pid] of leads) {
          const ws = workersOf(pid);
          const perRow = perRowOf(ws.length);
          ws.forEach(([wid], i) => {
            const row = Math.floor(i / perRow), inRow = Math.min(perRow, ws.length - row * perRow), col = i % perRow;
            pos[wid] = { x: pos[pid].x + (col - (inRow - 1) / 2) * (NW + GAP), y: 444 + row * 104 };
            H = Math.max(H, 444 + row * 104 + NH / 2 + 24);
          });
        }
        const edge = (a: string, b: string) => { const p = pos[a], c = pos[b]; return `M ${p.x} ${p.y + NH / 2} C ${p.x} ${(p.y + c.y) / 2}, ${c.x} ${(p.y + c.y) / 2}, ${c.x} ${c.y - NH / 2}`; };
        const doneToday = (board.recentRuns ?? []).filter((r) => r.status === "success" && new Date(r.started_at).toDateString() === new Date().toDateString()).length;
        const STATUS_UI = { working: { dot: "#60a5fa", label: "WORKING" }, problem: { dot: "#f87171", label: "PROBLEM" }, benched: { dot: "#6b7280", label: "BENCHED" }, resting: { dot: "#7dd3fc", label: "RESTING" }, fresh: { dot: "#34d399", label: "JUST RAN ✓" }, idle: { dot: "#4b5563", label: open ? "ON DUTY" : "IDLE" } } as const;
        const Node = ({ pid }: { pid: string }) => {
          const p = ORG[pid];
          const st = p.kind === "human" ? null : p.kind === "lead" ? leadStatus(pid) : statusOf(p.agent_id);
          const ui = st ? STATUS_UI[st] : null;
          const { x, y } = pos[pid];
          return (
            <g transform={`translate(${x - NW / 2}, ${y - NH / 2})`} onClick={() => { if (p.kind === "human") return; setCommsParty(pid); setCommsKind(""); setView("comms"); }} className={p.kind === "human" ? undefined : "cursor-pointer"}>
              <rect width={NW} height={NH} rx={14} fill={st === "working" ? "rgba(30,58,138,0.45)" : "rgba(17,24,39,0.92)"} stroke={st === "problem" ? "#b91c1c" : p.color} strokeOpacity={st === "problem" ? 0.9 : 0.45} strokeWidth={1.4} />
              <text x={13} y={30} fontSize={18}>{p.emoji}</text>
              <text x={44} y={26} fontSize={13.5} fontWeight={700} fill="#f9fafb">{p.name}</text>
              <text x={44} y={42} fontSize={9.5} fill="#9ca3af">{p.role}</text>
              {ui && (<><circle cx={19} cy={55} r={3} fill={ui.dot}>{st === "working" && <animate attributeName="opacity" values="1;0.25;1" dur="1.4s" repeatCount="indefinite" />}</circle>
                <text x={28} y={58.5} fontSize={8} fontWeight={700} letterSpacing={0.6} fill={ui.dot}>{ui.label}</text></>)}
            </g>
          );
        };
        return (
          <div className="rounded-2xl border border-gray-800 bg-gray-950 overflow-x-auto" data-aftour="orgchart"
            ref={(el) => { if (el && !el.dataset.centered) { el.dataset.centered = "1"; el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; } }}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-3 text-[11px] text-gray-500">
              <span className="text-white font-bold text-sm">SwiftCard · the company</span>
              <span>✅ {doneToday} run(s) completed today</span>
              <span>🧮 {fmtTok(monthTokens)} tokens this month</span>
              <span>{board.pendingTotal} item(s) waiting for you</span>
              <span className="ml-auto text-gray-600 hidden sm:inline">click anyone to read their messages</span>
              <span className="ml-auto text-gray-600 sm:hidden">swipe to pan · tap anyone for their messages</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[900px]" role="img" aria-label="Live org chart of the agent company">
              <style>{`.af-edge{fill:none;stroke-width:1.6;opacity:.35}.af-live{stroke-width:2.6;opacity:.95;stroke-dasharray:7 9;animation:afdash 1.1s linear infinite}@keyframes afdash{to{stroke-dashoffset:-16}}`}</style>
              <path d={edge("owner", "atlas")} className={`af-edge ${statusOf("manager") === "working" ? "af-live" : ""}`} stroke="#38bdf8" />
              {leads.map(([pid, p]) => <path key={pid} d={edge("atlas", pid)} className={`af-edge ${leadStatus(pid) === "working" ? "af-live" : ""}`} stroke={p.color} />)}
              {leads.flatMap(([pid, p]) => workersOf(pid).map(([wid, w]) => <path key={wid} d={edge(pid, wid)} className={`af-edge ${statusOf(w.agent_id) === "working" ? "af-live" : ""}`} stroke={p.color} />))}
              {Object.keys(pos).map((pid) => <Node key={pid} pid={pid} />)}
            </svg>
          </div>
        );
      })()}

      {view === "comms" && (
        <div className="space-y-3" data-aftour="comms">
          <div className="flex flex-wrap gap-1.5 items-center">
            {([["", "All"], ["a2a", "🤖 Agent ↔ agent"], ["owner_in", "👑 From you"], ["owner_out", "📬 To you"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setCommsKind(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${commsKind === k ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300 bg-gray-900 border border-gray-800"}`}>{label}</button>
            ))}
            <select value={commsParty} onChange={(e) => setCommsParty(e.target.value)} className="bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5 ml-1">
              <option value="">Everyone</option>
              {Object.entries(ORG).filter(([pid]) => pid !== "owner").map(([pid, p]) => <option key={pid} value={pid}>{p.emoji} {p.name} · {p.role}</option>)}
            </select>
            <span className="text-gray-600 text-[10px] ml-auto">the company chat log — every order, report, and escalation · refreshes every 15s</span>
          </div>
          {msgs.length === 0 && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
              <p className="text-gray-300 font-semibold">No messages{commsParty ? ` involving ${firstName(commsParty)}` : ""} yet.</p>
              <p className="text-gray-500 text-sm mt-1.5">Open the office (▶ Start All), wake a team (or Run once on any agent), and the dispatches, report-backs, and escalations appear here as they happen.</p>
            </div>
          )}
          <div className="space-y-1.5">
            {msgs.map((m) => {
              const from = ORG[m.from_id]; const to = m.to_id === "all" ? null : ORG[m.to_id];
              return (
                <div key={m.id} className={`rounded-xl border px-4 py-2.5 ${m.kind === "owner_in" ? "border-amber-900/50 bg-amber-950/15" : m.kind === "owner_out" ? "border-sky-900/50 bg-sky-950/15" : "border-gray-800 bg-gray-900"}`}>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                    <span className="font-bold text-white whitespace-nowrap">{from?.emoji} {from?.name ?? m.from_id}</span>
                    <span className="text-gray-600">→</span>
                    <span className="font-bold text-gray-300 whitespace-nowrap">{m.to_id === "all" ? "📢 everyone" : `${to?.emoji} ${to?.name ?? m.to_id}`}</span>
                    <span className="text-gray-600 text-[10px]">{from?.role ?? ""}{to ? ` → ${to.role}` : ""}</span>
                    <span className="text-gray-600 text-[10px] ml-auto whitespace-nowrap">{ago(m.created_at)}</span>
                  </div>
                  <p className="text-gray-300 text-[13px] mt-1 leading-relaxed whitespace-pre-wrap">{m.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "queue" && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5">
              {[["pending", "pending — needs you"], ["posted", "posted ✓ (auto)"], ["approved", "approved"], ["rejected", "rejected"], ["contacted", "sent"], ["replied", "got replies"], ["converted", "converted"], ["published", "published"], ["acknowledged", "read"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5">
              <option value="">All agents</option>
              {Object.entries(AGENT_NAMES).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5">
              <option value="">All types</option>
              {Object.entries(TYPE_LABEL).map(([t, l]) => <option key={t} value={t}>{l}</option>)}
            </select>
            {filterStatus === "pending" && pendingItems.length > 1 && (
              <button onClick={() => setSelected(selected.size === pendingItems.length ? new Set() : new Set(pendingItems.map((i) => i.id)))} className="text-xs text-gray-400 hover:text-white px-2 py-1.5 underline underline-offset-2">
                {selected.size === pendingItems.length ? "Clear selection" : `Select all shown (${pendingItems.length})`}
              </button>
            )}
            {pendingProspects.length > 0 && <button onClick={() => downloadCsv(pendingProspects)} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full ml-auto whitespace-nowrap">⬇ Prospects CSV ({pendingProspects.length})</button>}
          </div>

          {items.length === 0 && !loading && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
              <p className="text-gray-300 font-semibold">{filterStatus === "pending" ? "Nothing needs you right now." : `Nothing with status “${filterStatus}”.`}</p>
              <p className="text-gray-500 text-sm mt-1.5">{open ? "The agents are on duty — new work lands here as they finish." : <>Press <button onClick={() => control("start_all")} className="text-blue-400 underline">Start All</button>, wake a team, and results land here.</>}</p>
            </div>
          )}

          <div className="space-y-2">
            {items.map((it, idx) => {
              const conn = CONNECTOR_RULES.find((r) => r.matches(it));
              const connReady = !!(conn && board.connectors?.[conn.id]);
              const postedUrl = (it.payload?.posted_url ?? it.payload?.higgsfield_status_url) as string | undefined;
              return (
              <div key={it.id} data-aftour={idx === 0 ? "itemcard" : undefined} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <div className="flex flex-wrap items-start gap-2">
                  {it.status === "pending" && (
                    <label data-aftour={idx === 0 ? "checkbox" : undefined} className="mt-0.5 flex items-center gap-1 cursor-pointer select-none" title="Tick several items, then approve or reject them all at once">
                      <input type="checkbox" checked={selected.has(it.id)} onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(it.id); else n.delete(it.id); setSelected(n); }} className="accent-blue-600 w-4 h-4" />
                      <span className="text-[9px] text-gray-600 uppercase">select</span>
                    </label>
                  )}
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-blue-400">{AGENT_NAMES[it.agent_id] ?? it.agent_id}</span>
                      <span className="text-[10px] text-gray-600">{TYPE_LABEL[it.item_type] ?? it.item_type}{it.platform ? ` · ${it.platform}` : ""} · {ago(it.created_at)}</span>
                    </div>
                    <p className="text-white text-sm font-semibold mt-1">{it.title}</p>
                    {it.target_url && <a href={it.target_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline break-all">{it.target_url}</a>}
                    {it.context && <p className="text-gray-500 text-xs mt-1.5 whitespace-pre-wrap">{it.context}</p>}
                    {editing === it.id ? (
                      <div className="mt-2">
                        <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={8} className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-gray-200 text-sm font-mono" />
                        <div className="flex gap-2 mt-1.5">
                          <button onClick={() => act([it.id], "edited", editText)} className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-full">Save my version</button>
                          <button onClick={() => setEditing(null)} className="text-xs text-gray-500 px-2">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      it.content && <pre className="mt-2 text-gray-300 text-[13px] whitespace-pre-wrap font-sans bg-gray-950/60 border border-gray-800/60 rounded-lg p-3 max-h-64 overflow-y-auto">{it.content}</pre>
                    )}
                  </div>
                  {it.status === "pending" && editing !== it.id && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {connReady && (
                        <button onClick={() => act([it.id], "approved")} title="Approve = it happens: this posts/sends immediately, as you." className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-full whitespace-nowrap">✓ Approve &amp; {conn!.label}</button>
                      )}
                      {!connReady && (it.item_type === "outreach_draft" || it.item_type === "reply_draft" || it.item_type === "influencer" || it.item_type === "generic") && (
                        <button onClick={() => copyApprove(it, "the platform")} title="Copies to your clipboard and marks it approved. YOU paste and send." className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full whitespace-nowrap">Approve &amp; Copy</button>
                      )}
                      {!connReady && it.item_type === "video_script" && <button onClick={() => copyApprove(it, "Higgsfield")} className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full whitespace-nowrap">Copy to Higgsfield</button>}
                      {conn && !connReady && <span className="text-[10px] text-gray-600 max-w-[160px] leading-snug">⚡ auto-{conn.label} available — connect it in Settings</span>}
                      {it.item_type === "blog_post" && <button onClick={() => act([it.id], "published")} title="Goes live on swiftcard.me/blog immediately" className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full whitespace-nowrap">Publish</button>}
                      {it.item_type === "prospect" && <button onClick={() => act([it.id], "contacted")} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full whitespace-nowrap">Mark contacted</button>}
                      {(it.item_type === "security_finding" || it.item_type === "seo_report" || it.item_type === "perf_report" || it.item_type === "flow_finding" || it.item_type === "digest") && (
                        <button onClick={() => act([it.id], "acknowledged")} title="Approve = noted and filed. Reports never execute anything — a code fix ships only when you merge its draft PR." className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-full whitespace-nowrap">✓ Approved</button>
                      )}
                      {it.payload && "pr_url" in (it.payload as object) && (
                        <>
                          {!(it.payload as Record<string, unknown>).fix_shipped && (
                            <button onClick={() => shipFix(it)} disabled={busy} title="Merges the Fixer's tested draft PR (agent-fix/* → main, checks green) and auto-deploys. Your click IS the ship decision." className="text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-full whitespace-nowrap">✓ Approve &amp; Ship fix</button>
                          )}
                          <a href={String((it.payload as Record<string, unknown>).pr_url)} target="_blank" rel="noreferrer" className="text-xs bg-blue-800 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-center whitespace-nowrap">{(it.payload as Record<string, unknown>).fix_shipped ? "Shipped ✓ — view PR" : "View the fix (PR)"}</a>
                        </>
                      )}
                      {(it.item_type === "outreach_draft" || it.item_type === "reply_draft" || it.item_type === "influencer" || it.item_type === "video_script" || it.item_type === "blog_post" || it.item_type === "generic") && (
                        <button onClick={() => { setEditing(it.id); setEditText(it.content ?? ""); }} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full whitespace-nowrap">Edit</button>
                      )}
                      <button onClick={() => act([it.id], "rejected")} title="Not useful — filed to History; nothing deleted or sent" className="text-xs text-red-400 hover:text-red-300 px-3 py-1">Reject</button>
                    </div>
                  )}
                  {it.status === "approved" && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {it.item_type === "blog_post" && <button onClick={() => act([it.id], "published")} className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full whitespace-nowrap">Publish</button>}
                      {(it.item_type === "outreach_draft" || it.item_type === "reply_draft" || it.item_type === "influencer") && (
                        <>
                          <button onClick={() => act([it.id], "contacted")} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full whitespace-nowrap">Mark sent</button>
                          <button onClick={() => act([it.id], "replied")} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full whitespace-nowrap">Got a reply</button>
                          <button onClick={() => act([it.id], "converted")} className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full whitespace-nowrap">Converted 🎉</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {postedUrl && it.status === "posted" && (
                  <a href={postedUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-emerald-400 hover:underline break-all">✅ posted{it.payload?.posted_via ? ` via ${String(it.payload.posted_via)}` : ""} — view result →</a>
                )}
              </div>
            ); })}
          </div>

          {selected.size > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-[60] bg-gray-900/95 backdrop-blur border-t border-gray-700 px-4 py-3">
              <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2">
                <p className="text-white text-sm font-semibold flex-1 min-w-[180px]">{selected.size} selected <span className="text-gray-500 font-normal text-xs">— approve keeps them for you; reject files them away. Nothing gets sent either way.</span></p>
                <button onClick={() => act([...selected], "approved")} className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-full whitespace-nowrap">✓ Approve selected</button>
                <button onClick={() => act([...selected], "rejected")} className="text-xs bg-red-900 hover:bg-red-800 text-white font-bold px-4 py-2 rounded-full whitespace-nowrap">✗ Reject selected</button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-white px-2 py-2">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}

      {view === "history" && (
        <div data-aftour="historylist" className="space-y-1.5">
          <p className="text-gray-500 text-xs">Every decision you&apos;ve made, newest first. Record outcomes on sent outreach — that&apos;s how you learn which agents earn their keep.</p>
          {history.length === 0 && <p className="text-gray-500 text-sm">Nothing yet — approve or reject something and it lands here.</p>}
          {history.map((h) => (
            <div key={h.id} className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2.5 flex flex-wrap items-center gap-2 text-xs min-w-0">
              <span className={`font-bold whitespace-nowrap ${h.action === "approved" || h.action === "posted" || h.action === "published" || h.action === "converted" ? "text-emerald-400" : h.action === "rejected" ? "text-red-400" : "text-gray-400"}`}>
                {{ approved: "You approved", posted: "AUTO-POSTED", rejected: "You rejected", edited: "You edited", published: "You published", acknowledged: "You read", contacted: "You sent", replied: "They replied to", converted: "CONVERTED", csv_downloaded: "You downloaded" }[h.action] ?? h.action}
              </span>
              <span className="text-gray-300 flex-1 min-w-[180px] truncate">{h.agent_queue_items?.title ?? "(item removed)"}</span>
              <span className="text-gray-600 whitespace-nowrap">{AGENT_NAMES[h.agent_queue_items?.agent_id ?? ""] ?? ""} · {ago(h.created_at)}</span>
              {h.item_id && (h.action === "approved" || h.action === "contacted") && (h.agent_queue_items?.item_type === "outreach_draft" || h.agent_queue_items?.item_type === "reply_draft" || h.agent_queue_items?.item_type === "influencer") && h.agent_queue_items?.status !== "converted" && (
                <span className="flex gap-1">
                  <button onClick={() => act([h.item_id!], "replied")} className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded-full whitespace-nowrap">got a reply</button>
                  <button onClick={() => act([h.item_id!], "converted")} className="text-[10px] bg-emerald-900 hover:bg-emerald-800 text-emerald-300 px-2 py-1 rounded-full whitespace-nowrap">converted 🎉</button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {view === "settings" && (
        <div data-aftour="settingslist" className="space-y-2 max-w-3xl">
          <p className="text-gray-500 text-xs">The levers. Everything takes effect on the next run — no deploys.</p>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-white text-sm font-semibold">Connections — Approve becomes the send button</p>
            <p className="text-gray-500 text-xs mt-0.5 mb-2.5">When a platform is connected, approving an item posts it immediately as you. Not connected = the classic Approve &amp; Copy flow. Tokens live in Vercel env vars — nothing is stored in the browser.</p>
            <div className="space-y-1.5">
              {CONNECTOR_RULES.map((c) => {
                const on = !!board.connectors?.[c.id];
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${on ? "bg-emerald-400" : "bg-gray-700"}`} />
                    <span className="text-gray-200 font-semibold capitalize">{c.id}</span>
                    <span className="text-gray-500">{c.label} on Approve</span>
                    {on ? <span className="text-emerald-400 font-semibold ml-auto">Connected ✓</span>
                      : <span className="text-gray-600 ml-auto">set <code className="text-gray-400">{CONNECTOR_ENVS[c.id]}</code> in Vercel</span>}
                  </div>
                );
              })}
              <p className="text-gray-600 text-[11px] pt-1">Instagram, Facebook &amp; X don&apos;t allow personal auto-posting through their public APIs — those stay Approve &amp; Copy. Blog posts already publish themselves via the Publish button.</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <p className="text-white text-sm font-semibold">Monthly token budget for the whole system</p>
              <p className="text-gray-500 text-xs mt-0.5">The hard ceiling — agents stop rather than pass it (comms + evening report; no email). {fmtTok(monthTokens)} tokens used this month.</p>
            </div>
            <label className="flex items-center gap-1 text-sm text-white">$
              <input type="number" step={500000} defaultValue={monthlyCapTokens} onBlur={(e) => saveSetting({ system: { monthly_usage_cap_tokens: Number(e.target.value) } })} className="w-20 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm" />
            </label>
          </div>
          {TEAMS.flatMap((t) => t.agents).map((id) => { const s = byId[id]; if (!s) return null; return (
            <div key={id} className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex flex-wrap items-center gap-x-4 gap-y-2 min-w-0">
              <div className="min-w-[150px]">
                <p className="text-white text-sm font-semibold">{AGENT_NAMES[id]}</p>
                <p className="text-[10px] text-gray-600">{AGENT_ROLE[id]}</p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap" title="Off = benched everywhere">
                <input type="checkbox" checked={s.enabled} onChange={(e) => saveSetting({ agent_id: id, enabled: e.target.checked })} className="accent-blue-600" /> active
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap" title="Most items per run — keeps the queue reviewable">
                max <input type="number" defaultValue={s.output_cap} onBlur={(e) => saveSetting({ agent_id: id, output_cap: Number(e.target.value) })} className="w-14 bg-gray-950 border border-gray-700 rounded px-1.5 py-1 text-white" /> /run
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap" title="Budget per run">
                <input type="number" step={50000} defaultValue={s.usage_cap_tokens ?? 500000} onBlur={(e) => saveSetting({ agent_id: id, usage_cap_tokens: Number(e.target.value) })} className="w-24 bg-gray-950 border border-gray-700 rounded px-1.5 py-1 text-white" /> tok/run
              </label>
              {/* A watchdog has no rhythm to pick — offering one would imply
                  gaps in the watch. Owner order 2026-09-03: they run for as
                  long as the office is open and Active is ticked. */}
              {CONTINUOUS.has(id) ? (
                <span className="text-[11px] text-emerald-400/90">on watch continuously — no rhythm; the <strong className="font-semibold">active</strong> box is the only switch</span>
              ) : (
                <label className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap" title="Their working rhythm while the system is running">
                  rhythm
                  <select value={s.schedule ?? ""} onChange={(e) => saveSetting({ agent_id: id, schedule: e.target.value || null }, e.target.value ? "Rhythm saved — they'll keep it whenever they're awake." : "Back on their default rhythm.")} className="bg-gray-950 border border-gray-700 rounded px-1.5 py-1 text-white">
                    {CADENCES.map(([v, l]) => <option key={v} value={v}>{v === "" && DEFAULT_SCHEDULES[id] ? `default — ${CADENCES.find(([cv]) => cv === DEFAULT_SCHEDULES[id])?.[1] ?? DEFAULT_SCHEDULES[id]}` : l}</option>)}
                    {s.schedule && !CADENCES.some(([v]) => v === s.schedule) && <option value={s.schedule}>{s.schedule}</option>}
                  </select>
                </label>
              )}
            </div>
          ); })}
        </div>
      )}

      {step && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/70" onClick={() => setTourStep(null)} />
          {tourRect && <div className="absolute rounded-xl ring-2 ring-blue-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] pointer-events-none transition-all duration-300" style={{ top: tourRect.top, left: tourRect.left, width: tourRect.width, height: tourRect.height }} />}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-6 sm:bottom-10 w-[92vw] max-w-md rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl p-5">
            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">Tour · {tourStep! + 1} of {TOUR.length}</p>
            <p className="text-white font-bold text-[15px] mt-1">{step.title}</p>
            <p className="text-gray-400 text-[13px] mt-1.5 leading-relaxed">{step.body}</p>
            <div className="flex items-center gap-2 mt-4">
              <button onClick={() => setTourStep(null)} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-2">Skip</button>
              <div className="flex-1" />
              {tourStep! > 0 && <button onClick={() => setTourStep(tourStep! - 1)} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-full">← Back</button>}
              {tourStep! < TOUR.length - 1
                ? <button onClick={() => setTourStep(tourStep! + 1)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-full">Next →</button>
                : <button onClick={() => setTourStep(null)} className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-full">Done ✓</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
