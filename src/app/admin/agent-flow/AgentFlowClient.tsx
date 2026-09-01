"use client";

import { useCallback, useEffect, useState } from "react";

// ── Agent Flow: mission control for the marketing agents ────────────────────
// Written to be read the way the owner talks: every button says what it does,
// every action confirms what just happened, and nothing is jargon. The guided
// tour (Take a tour, left of the view tabs) walks every piece.

type Settings = { agent_id: string; enabled: boolean; paused: boolean; output_cap: number; usage_cap_usd: number; schedule: string | null };
type RunRow = { id: string; agent_id: string; status: string; started_at: string; finished_at: string | null; output_count: number; usage_usd: number; summary: string | null; trigger: string };
type Item = { id: string; agent_id: string; item_type: string; platform: string | null; target: string | null; target_url: string | null; title: string; content: string | null; context: string | null; status: string; payload: Record<string, unknown> | null; created_at: string };
type Board = { ready: boolean; message?: string; settings: Settings[]; system: { paused: boolean; monthly_usage_cap_usd: number; digest_email: string; auto_pause_at: string | null }; latestRuns: Record<string, RunRow>; recentRuns: RunRow[]; pendingBy: Record<string, number>; pendingTotal: number; spendBy: Record<string, number>; dispatchConfigured: boolean };

const AGENT_NAMES: Record<string, string> = {
  outreach: "Outreach Scout", prospects: "Link-in-bio Prospects", seo: "SEO", blog: "Blog Writer",
  social: "Social Content", mentions: "Mentions Monitor", influencer: "Influencer Scout",
  bugwatch: "Bug Watch", security: "Security Watch", perf: "Performance Watch", manager: "Manager / Digest",
};
const DRAFT_ONLY = new Set(["outreach", "prospects", "social", "mentions", "influencer"]);
const TYPE_LABEL: Record<string, string> = {
  outreach_draft: "Outreach draft", prospect: "Prospect", reply_draft: "Reply draft", influencer: "Influencer pitch",
  video_script: "Video script", blog_post: "Blog post", seo_report: "SEO report", security_finding: "Security finding",
  perf_report: "Speed report", digest: "Report", generic: "Post draft",
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
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "now";
  const m = Math.ceil(ms / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
function stateOf(r?: RunRow, s?: Settings): { label: string; cls: string } {
  if (s && !s.enabled) return { label: "Off", cls: "bg-gray-800 text-gray-500" };
  if (s?.paused) return { label: "Paused", cls: "bg-amber-900/40 text-amber-400" };
  if (!r) return { label: "Never run", cls: "bg-gray-800 text-gray-400" };
  if (r.status === "running") return { label: "Working…", cls: "bg-blue-900/50 text-blue-300 animate-pulse" };
  if (r.status === "failed") return { label: "Problem", cls: "bg-red-900/50 text-red-400" };
  if (r.status === "paused") return { label: "Stopped mid-run", cls: "bg-amber-900/40 text-amber-400" };
  if (r.status === "skipped_cap") return { label: "Hit the cap", cls: "bg-amber-900/40 text-amber-400" };
  if (r.status.startsWith("skipped")) return { label: "Skipped", cls: "bg-gray-800 text-gray-400" };
  return { label: "Done ✓", cls: "bg-emerald-900/40 text-emerald-400" };
}
// ET time helper for the auto-stop quick options.
function etToday(hour: number, minute = 0): string {
  const now = new Date();
  const et = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const p = Object.fromEntries(et.formatToParts(now).map((x) => [x.type, x.value]));
  // Build the ET wall-clock target, then find the UTC instant with that ET time.
  const guess = new Date(`${p.year}-${p.month}-${p.day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  const offsetMin = (Number(p.hour) * 60 + Number(p.minute)) - (now.getUTCHours() * 60 + now.getUTCMinutes());
  return new Date(guess.getTime() - offsetMin * 60000).toISOString();
}

// ── The guided tour ──────────────────────────────────────────────────────────
type TourStep = { view?: "queue" | "status" | "history" | "settings"; target?: string; title: string; body: string };
const TOUR: TourStep[] = [
  { title: "Welcome to Agent Flow", body: "This is the control room for your ten marketing and monitoring agents — think of them as your workers. They only move when you press a button, everything they produce waits here for your approval, and nothing is ever sent to another platform automatically. This tour walks every piece — Next to continue." },
  { target: "kpis", title: "The health strip", body: "Four numbers that tell you if anything needs you: items waiting for review, whether agents are working or hit a problem, this month's spend against your cap, and when the last Manager report landed." },
  { target: "startall", title: "Start All", body: "Runs every enabled agent right now, in the cloud. Your laptop can be closed. Each agent stops on its own when it hits its item cap or its per-run budget." },
  { target: "pauseall", title: "Pause All", body: "The stop button. Nothing new starts, and any agent mid-run stops at its next safe checkpoint — usually within seconds, at worst a couple of minutes. Whatever it finished is kept, and a session summary of everything done today is written to your queue the moment you press it." },
  { target: "autostop", title: "Auto-stop (your work-hours timer)", body: "Tell the system when to clock out: 'stop at 5 PM' or 'stop in 3 hours'. When the time hits, everything behaves exactly like Pause All — agents stop safely, nothing new starts — until you press Resume." },
  { view: "queue", target: "tabs", title: "The four views", body: "Review queue = what's waiting for you. Agents = who's doing what, with full logs. History = everything you've decided. Settings = each agent's on/off switch, caps, and schedule." },
  { view: "queue", target: "filters", title: "Filters and refresh", body: "Narrow the queue by agent, by type, or by status — 'pending' means waiting on you, 'rejected' and 'approved' show what you already decided (nothing is ever deleted). The page also refreshes itself every 30 seconds; the ↻ button does it instantly." },
  { view: "queue", target: "itemcard", title: "One item, anatomy", body: "Each card: which agent made it, what kind of thing it is, who or what it's about (with the real link), why it was surfaced, and the full draft. The buttons on the right are specific to the type — drafts get Approve & Copy, prospects get Mark contacted, blog posts get Publish, findings get Acknowledge." },
  { view: "queue", target: "checkbox", title: "Those checkboxes", body: "For handling MANY items at once. Tick a few (or 'Select all shown') and a bar appears with Approve selected / Reject selected. Approve = 'good, I'll use this' (it moves to Approved — nothing is sent anywhere). Reject = 'not useful' (it moves to Rejected, kept forever in History). One tap per item is fine too — the checkboxes are just the shortcut for a big batch." },
  { view: "status", target: "agentrow", title: "An agent's row", body: "Live state (Working… counts up in real time with what it's doing), its last result, month spend, and a tiny bar chart of its recent runs — a flatline means it's producing nothing and worth a look. Run now / Pause control just this one agent." },
  { view: "status", target: "logbtn", title: "Every agent keeps a diary", body: "▾ log opens that agent's full run history — every run's time, how long it took, what it produced, what it cost, and its own summary of what it did. This is where you check on a worker." },
  { view: "history", target: "historylist", title: "History — your decisions", body: "Everything you approved, rejected, edited, or published, newest first. For outreach you approved, come back here to record what happened — Got a reply / Converted — so you learn which agents actually make you money." },
  { view: "settings", target: "settingslist", title: "Settings — the levers", body: "Per agent: on/off, how many items per run, budget per run, and an optional daily schedule (off by default — agents never run on their own unless you set one). The monthly cap at the top is the hard ceiling for everything; agents stop and email you instead of passing it." },
  { title: "That's the whole machine", body: "Daily rhythm: press Start All (or let a schedule you set do it), come back to the badge, work the queue in a few minutes, and check the Manager report. Replay this tour anytime with Take a tour." },
];

export default function AgentFlowClient() {
  const [board, setBoard] = useState<Board | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [view, setView] = useState<"queue" | "status" | "history" | "settings">("queue");
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

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 4200); };
  const [now, setNow] = useState(() => Date.now());
  const anyRunning = !!board && Object.values(board.latestRuns ?? {}).some((r) => (r as RunRow).status === "running");
  const autoStopArmed = !!board?.system.auto_pause_at && new Date(board.system.auto_pause_at).getTime() > now;
  const autoStopHit = !!board?.system.auto_pause_at && new Date(board.system.auto_pause_at).getTime() <= now;
  useEffect(() => { if (!anyRunning && !autoStopArmed && tourStep === null) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [anyRunning, autoStopArmed, tourStep]);
  const [expanded, setExpanded] = useState<string | null>(null);

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

  // Tour: position the spotlight on the current step's target. All state
  // updates happen inside the timeout callback (never synchronously in the
  // effect body): the DOM is measured after the step's view has rendered, and
  // when the view itself must switch, doing it here re-triggers this effect
  // (view is a dep) so the measurement lands on the freshly rendered target.
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
    else if (op === "pause_all") say("Paused. In-flight agents stop at their next checkpoint — a session summary was just written to your queue.");
    else if (op === "resume_all") say("Resumed. Agents can start again (auto-stop cleared).");
    else if (op === "start_all") say("Started every enabled agent in the cloud. Watch them under Agents.");
    else if (op === "run") say(`${AGENT_NAMES[agent_id!] ?? agent_id} is starting in the cloud — results land in the queue.`);
    else if (op === "pause") say(`${AGENT_NAMES[agent_id!] ?? agent_id} paused. If it was mid-run it stops at its next checkpoint.`);
    else say("Done.");
    load();
  };
  const ACT_TOAST: Record<string, string> = {
    approved: "Approved — nothing is sent automatically; it's yours to use. Find it anytime under status: approved.",
    rejected: "Rejected — moved out of your way, kept forever in History. Nothing was deleted.",
    acknowledged: "Marked as read — it lives on under status: acknowledged.",
    published: "Published — it's live on swiftcard.me/blog right now.",
    contacted: "Marked contacted — when they answer, record it in History (Got a reply / Converted).",
    replied: "Recorded the reply 🎯", converted: "Recorded the conversion 🎉", edited: "Saved your edit — the item stays pending with your version.",
  };
  const act = async (ids: string[], action: string, content?: string) => {
    if (!ids.length) return;
    const r = await fetch("/api/admin/agents/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action, content }) }).then((x) => x.json()).catch(() => null);
    if (!r?.ok) { say("⚠ That didn't save — check your connection and try again."); return; }
    say(ids.length > 1 ? `${ids.length} items ${action}. ${ACT_TOAST[action] ?? ""}` : ACT_TOAST[action] ?? "Done.");
    setSelected(new Set()); setEditing(null); load();
  };
  const saveSetting = async (patch: Record<string, unknown>, note?: string) => {
    const r = await fetch("/api/admin/agents/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).then((x) => x.json()).catch(() => null);
    say(r?.ok ? (note ?? "Saved — takes effect on the next run, no deploy needed.") : "⚠ Couldn't save that.");
    load();
  };
  const copyApprove = async (it: Item, label: string) => {
    try { await navigator.clipboard.writeText(it.content ?? ""); say(`Copied to your clipboard — paste it into ${label}. Marked approved.`); } catch { say("Copy failed — select the text by hand."); }
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
    say(`Downloaded ${rows.length} prospects as a CSV — work it top to bottom, then Mark contacted as you go.`);
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
  const pendingItems = items.filter((i) => i.status === "pending");
  const pendingProspects = pendingItems.filter((i) => i.item_type === "prospect");
  const monthSpend = Object.values(board.spendBy ?? {}).reduce((t, n) => t + n, 0);
  const capPct = Math.min(100, Math.round((monthSpend / Number(board.system.monthly_usage_cap_usd || 1)) * 100));
  const failedCount = agents.filter((a) => board.latestRuns[a.agent_id]?.status === "failed").length;
  const runningCount = agents.filter((a) => board.latestRuns[a.agent_id]?.status === "running").length;
  const lastDigest = (board.recentRuns ?? []).find((r) => r.agent_id === "manager" && r.status === "success");
  const runsByAgent: Record<string, RunRow[]> = {};
  for (const r of board.recentRuns ?? []) (runsByAgent[r.agent_id] ??= []).push(r);
  const step = tourStep !== null ? TOUR[tourStep] : null;

  return (
    <div className="space-y-5 pb-24">
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] max-w-[92vw] bg-gray-800 border border-gray-700 text-white text-sm px-4 py-2.5 rounded-2xl shadow-xl text-center">{toast}</div>}

      {/* Auto-stop banners */}
      {autoStopHit && (
        <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-amber-300 text-sm font-semibold flex-1">⏰ Auto-stop time reached — everything is holding, exactly like Pause All.</p>
          <button onClick={() => control("resume_all")} className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-full">Resume work</button>
        </div>
      )}
      {board.system.paused && !autoStopHit && (
        <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-amber-300 text-sm font-semibold flex-1">⏸ System paused — nothing starts; in-flight agents stop at their next checkpoint.</p>
          <button onClick={() => control("resume_all")} className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-full">Resume</button>
        </div>
      )}

      {/* Health strip */}
      <div data-aftour="kpis" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5">
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide">Waiting for you</p>
          <p className="text-white text-xl font-bold tabular-nums mt-0.5">{board.pendingTotal}</p>
        </div>
        <div className={`rounded-xl p-3.5 border ${runningCount ? "bg-blue-950/30 border-blue-800/50" : failedCount ? "bg-red-950/25 border-red-800/60" : "bg-gray-900 border-gray-800"}`}>
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide">Agents</p>
          <p className="text-white text-xl font-bold mt-0.5">
            {runningCount ? <span className="text-blue-300">{runningCount} working</span> : failedCount ? <span className="text-red-400">{failedCount} need a look</span> : "all quiet"}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5">
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide">Month spend</p>
          <p className="text-white text-xl font-bold tabular-nums mt-0.5">${monthSpend.toFixed(2)}<span className="text-gray-600 text-xs font-normal"> / ${Number(board.system.monthly_usage_cap_usd).toFixed(0)} cap</span></p>
          <div className="h-1 bg-gray-800 rounded-full mt-1.5"><div className={`h-1 rounded-full ${capPct > 85 ? "bg-amber-500" : "bg-blue-600"}`} style={{ width: `${capPct}%` }} /></div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5">
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide">Last report</p>
          <p className="text-white text-xl font-bold mt-0.5">{lastDigest ? ago(lastDigest.started_at) : "—"}</p>
          {lastDigest && <button onClick={() => { setView("queue"); setFilterStatus("pending"); setFilterAgent("manager"); setFilterType("digest"); }} className="text-blue-400 text-[11px] hover:underline">open latest →</button>}
        </div>
      </div>

      {/* Run controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button data-aftour="startall" onClick={() => control("start_all")} disabled={busy || board.system.paused || autoStopHit} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-colors">▶ Start All</button>
        {board.system.paused || autoStopHit ? null : (
          <button data-aftour="pauseall" onClick={() => control("pause_all")} disabled={busy} className="bg-amber-700 hover:bg-amber-600 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-colors">⏸ Pause All</button>
        )}
        <div data-aftour="autostop" className="relative">
          <button onClick={() => setAutoStopOpen(!autoStopOpen)} className={`text-xs font-semibold px-3.5 py-2.5 rounded-full border transition-colors ${autoStopArmed ? "bg-amber-950/40 border-amber-700/60 text-amber-300" : "bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200"}`}>
            {autoStopArmed ? `⏰ stops in ${untilText(board.system.auto_pause_at!, now)}` : "⏰ Auto-stop: off"}
          </button>
          {autoStopOpen && (
            <div className="absolute z-40 mt-2 w-64 rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl p-3 space-y-1.5">
              <p className="text-gray-400 text-[11px] leading-snug mb-2">Clock-out timer: when it hits, everything stops safely — exactly like Pause All — until you Resume.</p>
              {([["Stop in 1 hour", "in1"], ["Stop in 3 hours", "in3"], ["Stop at 5:00 PM ET", "at17"], ["Stop at 8:00 PM ET", "at20"]] as const).map(([label, kind]) => (
                <button key={kind} onClick={() => {
                  const iso = kind === "in1" ? new Date(Date.now() + 3600e3).toISOString()
                    : kind === "in3" ? new Date(Date.now() + 3 * 3600e3).toISOString()
                    : etToday(kind === "at17" ? 17 : 20);
                  saveSetting({ system: { auto_pause_at: iso } }, `Auto-stop armed — work halts ${label.toLowerCase().replace("stop ", "")}.`);
                  setAutoStopOpen(false);
                }} className="w-full text-left text-xs text-gray-200 hover:bg-gray-800 rounded-lg px-3 py-2">{label}</button>
              ))}
              {autoStopArmed && <button onClick={() => { saveSetting({ system: { auto_pause_at: null } }, "Auto-stop cleared — no clock-out set."); setAutoStopOpen(false); }} className="w-full text-left text-xs text-red-400 hover:bg-gray-800 rounded-lg px-3 py-2">Turn off auto-stop</button>}
            </div>
          )}
        </div>
        {!board.dispatchConfigured && <span className="text-amber-400 text-xs">⚠ Run buttons need GITHUB_AGENTS_TOKEN (see README)</span>}
        <div data-aftour="tabs" className="ml-auto flex items-center gap-1">
          <button onClick={() => { setTourStep(0); }} className="px-3 py-1.5 rounded-full text-xs font-semibold text-blue-300 bg-blue-950/40 border border-blue-800/50 hover:bg-blue-900/40 transition-colors">✦ Take a tour</button>
          {([["queue", "Review queue"], ["status", "Agents"], ["history", "History"], ["settings", "Settings"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${view === v ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
              {label}{v === "queue" && board.pendingTotal > 0 ? ` (${board.pendingTotal})` : ""}
            </button>
          ))}
        </div>
      </div>

      {view === "queue" && (
        <>
          <p className="text-gray-500 text-xs -mt-1">Everything your agents produced, waiting on your call. Approving never sends anything anywhere — you stay the sender.</p>
          <div data-aftour="filters" className="flex flex-wrap gap-2 items-center">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5">
              {[["pending", "pending — needs you"], ["approved", "approved"], ["rejected", "rejected"], ["contacted", "contacted"], ["replied", "got replies"], ["converted", "converted"], ["published", "published"], ["acknowledged", "read"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5">
              <option value="">All agents</option>
              {Object.entries(AGENT_NAMES).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5">
              <option value="">All types</option>
              {Object.entries(TYPE_LABEL).map(([t, l]) => <option key={t} value={t}>{l}</option>)}
            </select>
            <button onClick={load} className="text-xs text-gray-400 hover:text-white px-2 py-1.5 transition-colors">{loading ? "↻ updating…" : "↻ Refresh"}</button>
            {updatedAt && <span className="text-gray-600 text-[10px]">updated {ago(new Date(updatedAt).toISOString())} · auto-refreshes every 30s</span>}
            {filterStatus === "pending" && pendingItems.length > 1 && (
              <button onClick={() => setSelected(selected.size === pendingItems.length ? new Set() : new Set(pendingItems.map((i) => i.id)))} className="text-xs text-gray-400 hover:text-white px-2 py-1.5 underline underline-offset-2">
                {selected.size === pendingItems.length ? "Clear selection" : `Select all shown (${pendingItems.length})`}
              </button>
            )}
            {pendingProspects.length > 0 && <button onClick={() => downloadCsv(pendingProspects)} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full ml-auto">⬇ Prospects CSV ({pendingProspects.length})</button>}
          </div>

          {items.length === 0 && !loading && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
              <p className="text-gray-300 font-semibold">{filterStatus === "pending" ? "Nothing needs you right now." : `Nothing with status “${filterStatus}”.`}</p>
              <p className="text-gray-500 text-sm mt-1.5">Agents only work when told to — press <button onClick={() => control("start_all")} className="text-blue-400 underline">Start All</button> or run one from <button onClick={() => setView("status")} className="text-blue-400 underline">Agents</button>, and results land here.</p>
            </div>
          )}

          <div className="space-y-2">
            {items.map((it, idx) => (
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
                      {(it.item_type === "outreach_draft" || it.item_type === "reply_draft" || it.item_type === "influencer" || it.item_type === "generic") && (
                        <button onClick={() => copyApprove(it, "the platform")} title="Copies the message to your clipboard and marks it approved. YOU paste and send it." className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full">Approve &amp; Copy</button>
                      )}
                      {it.item_type === "video_script" && (
                        <button onClick={() => copyApprove(it, "Higgsfield")} className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full">Copy to Higgsfield</button>
                      )}
                      {it.item_type === "blog_post" && (
                        <button onClick={() => act([it.id], "published")} title="Puts this post live on swiftcard.me/blog immediately" className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full">Publish</button>
                      )}
                      {it.item_type === "prospect" && (
                        <button onClick={() => act([it.id], "contacted")} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full">Mark contacted</button>
                      )}
                      {(it.item_type === "security_finding" || it.item_type === "seo_report" || it.item_type === "perf_report" || it.item_type === "digest") && (
                        <button onClick={() => act([it.id], "acknowledged")} title="Marks it read and moves it out of the pending list" className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full">Got it ✓</button>
                      )}
                      {it.payload && "pr_url" in (it.payload as object) && (
                        <a href={String((it.payload as Record<string, unknown>).pr_url)} target="_blank" rel="noreferrer" className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full text-center">View PR</a>
                      )}
                      {(it.item_type === "outreach_draft" || it.item_type === "reply_draft" || it.item_type === "influencer" || it.item_type === "video_script" || it.item_type === "blog_post" || it.item_type === "generic") && (
                        <button onClick={() => { setEditing(it.id); setEditText(it.content ?? ""); }} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full">Edit</button>
                      )}
                      <button onClick={() => act([it.id], "rejected")} title="Not useful — moves to History. Nothing is deleted or sent." className="text-xs text-red-400 hover:text-red-300 px-3 py-1">Reject</button>
                    </div>
                  )}
                  {it.status === "approved" && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {it.item_type === "blog_post" && <button onClick={() => act([it.id], "published")} className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full">Publish</button>}
                      {(it.item_type === "outreach_draft" || it.item_type === "reply_draft" || it.item_type === "influencer") && (
                        <>
                          <button onClick={() => act([it.id], "contacted")} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full">Mark sent</button>
                          <button onClick={() => act([it.id], "replied")} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full">Got a reply</button>
                          <button onClick={() => act([it.id], "converted")} className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full">Converted 🎉</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bulk action bar — appears when items are ticked */}
          {selected.size > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-[60] bg-gray-900/95 backdrop-blur border-t border-gray-700 px-4 py-3">
              <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2">
                <p className="text-white text-sm font-semibold flex-1 min-w-[180px]">{selected.size} selected <span className="text-gray-500 font-normal text-xs">— approve keeps them for you to use; reject files them away. Nothing gets sent either way.</span></p>
                <button onClick={() => act([...selected], "approved")} className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-full">✓ Approve selected</button>
                <button onClick={() => act([...selected], "rejected")} className="text-xs bg-red-900 hover:bg-red-800 text-white font-bold px-4 py-2 rounded-full">✗ Reject selected</button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-white px-2 py-2">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}

      {view === "status" && (
        <div className="grid gap-2">
          <p className="text-gray-500 text-xs -mt-1">Your workers. Run one, pause one, or open its ▾ log to read its diary.</p>
          {agents.map((s, idx) => {
            const r = board.latestRuns[s.agent_id];
            const st = stateOf(r, s);
            const bad = st.label === "Problem" || st.label === "Hit the cap";
            return (
              <div key={s.agent_id} data-aftour={idx === 0 ? "agentrow" : undefined} className={`rounded-xl border p-4 flex flex-wrap items-center gap-3 ${bad ? "border-red-800/60 bg-red-950/20" : "border-gray-800 bg-gray-900"}`}>
                <div className="min-w-[150px]">
                  <p className="text-white text-sm font-semibold">{AGENT_NAMES[s.agent_id] ?? s.agent_id}</p>
                  <p className="text-[10px] uppercase tracking-wide text-gray-600">{DRAFT_ONLY.has(s.agent_id) ? "drafts only — can't post" : s.agent_id === "manager" ? "reports only" : s.agent_id === "perf" ? "speed watchdog" : "works on our own stuff"}</p>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                <div className="text-xs text-gray-500 flex-1 min-w-[200px]">
                  <span>{r?.status === "running" ? `working for ${dur(r.started_at, null, now)}` : `last ran ${ago(r?.started_at ?? null)}`} · {r ? `made ${r.output_count} item(s) · $${Number(r.usage_usd).toFixed(2)}` : "never run"} · ${Number(board.spendBy[s.agent_id] ?? 0).toFixed(2)} this month</span>
                  {r?.summary && <p className={`mt-0.5 truncate ${r.status === "running" ? "text-blue-300" : bad ? "text-red-400/80" : "text-gray-600"}`}>{r.status === "running" ? "⋯ " : ""}{r.summary}</p>}
                </div>
                <div className="hidden sm:flex items-end gap-0.5 h-6 w-16" title="last runs, newest right — a flatline means it's producing nothing">
                  {(runsByAgent[s.agent_id] ?? []).slice(0, 8).reverse().map((rr) => (
                    <div key={rr.id} className={`flex-1 rounded-sm ${rr.status === "failed" ? "bg-red-700" : "bg-blue-800"}`} style={{ height: `${Math.min(100, 15 + rr.output_count * 20)}%` }} />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => control("run", s.agent_id)} disabled={busy || s.paused || !s.enabled || board.system.paused || autoStopHit} className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-full transition-colors">Run now</button>
                  <button onClick={() => control(s.paused ? "resume" : "pause", s.agent_id)} disabled={busy} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition-colors">{s.paused ? "Resume" : "Pause"}</button>
                  <button data-aftour={idx === 0 ? "logbtn" : undefined} onClick={() => setExpanded(expanded === s.agent_id ? null : s.agent_id)} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5 transition-colors">{expanded === s.agent_id ? "▴ close" : "▾ log"}</button>
                </div>
                {expanded === s.agent_id && (
                  <div className="w-full mt-2 border-t border-gray-800 pt-2 space-y-1">
                    {(runsByAgent[s.agent_id] ?? []).length === 0 && <p className="text-gray-600 text-xs">This agent hasn&apos;t run yet.</p>}
                    {(runsByAgent[s.agent_id] ?? []).slice(0, 10).map((rr) => (
                      <div key={rr.id} className="flex flex-wrap items-baseline gap-x-2 text-[11.5px]">
                        <span className="text-gray-600 tabular-nums shrink-0">{new Date(rr.started_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                        <span className={rr.status === "failed" ? "text-red-400 font-semibold" : rr.status === "success" ? "text-emerald-500" : "text-amber-400"}>{rr.status === "success" ? "done" : rr.status}</span>
                        <span className="text-gray-500">{dur(rr.started_at, rr.finished_at)} · {rr.output_count} item(s) · ${Number(rr.usage_usd).toFixed(2)} · {rr.trigger === "start_all" ? "via Start All" : rr.trigger}</span>
                        <span className="text-gray-400 basis-full sm:basis-auto sm:flex-1 truncate">{rr.summary}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === "history" && (
        <div data-aftour="historylist" className="space-y-1.5">
          <p className="text-gray-500 text-xs -mt-1">Every decision you&apos;ve made, newest first. For outreach you sent, record what came back — that&apos;s how you learn which agents earn their keep.</p>
          {history.length === 0 && <p className="text-gray-500 text-sm">Nothing yet — approve or reject something and it lands here.</p>}
          {history.map((h) => (
            <div key={h.id} className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2.5 flex flex-wrap items-center gap-2 text-xs">
              <span className={`font-bold ${h.action === "approved" || h.action === "published" || h.action === "converted" ? "text-emerald-400" : h.action === "rejected" ? "text-red-400" : "text-gray-400"}`}>
                {{ approved: "You approved", rejected: "You rejected", edited: "You edited", published: "You published", acknowledged: "You read", contacted: "You sent", replied: "They replied to", converted: "CONVERTED", csv_downloaded: "You downloaded" }[h.action] ?? h.action}
              </span>
              <span className="text-gray-300 flex-1 min-w-[200px]">{h.agent_queue_items?.title ?? "(item removed)"}</span>
              <span className="text-gray-600">{AGENT_NAMES[h.agent_queue_items?.agent_id ?? ""] ?? h.agent_queue_items?.agent_id} · {ago(h.created_at)}</span>
              {h.item_id && (h.action === "approved" || h.action === "contacted") && (h.agent_queue_items?.item_type === "outreach_draft" || h.agent_queue_items?.item_type === "reply_draft" || h.agent_queue_items?.item_type === "influencer") && h.agent_queue_items?.status !== "converted" && (
                <span className="flex gap-1">
                  <button onClick={() => act([h.item_id!], "replied")} className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded-full">got a reply</button>
                  <button onClick={() => act([h.item_id!], "converted")} className="text-[10px] bg-emerald-900 hover:bg-emerald-800 text-emerald-300 px-2 py-1 rounded-full">converted 🎉</button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {view === "settings" && (
        <div data-aftour="settingslist" className="space-y-2 max-w-3xl">
          <p className="text-gray-500 text-xs -mt-1">The levers. Everything here takes effect on the next run — no code, no deploys.</p>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <p className="text-white text-sm font-semibold">Monthly budget for the whole system</p>
                <p className="text-gray-500 text-xs mt-0.5">The hard ceiling. Agents refuse to start past it — and stop mid-run if it&apos;s crossed — then email you instead of spending more.</p>
              </div>
              <label className="flex items-center gap-1 text-sm text-white">$
                <input type="number" step="1" defaultValue={board.system.monthly_usage_cap_usd} onBlur={(e) => saveSetting({ system: { monthly_usage_cap_usd: Number(e.target.value) } })} className="w-20 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm" />
              </label>
            </div>
          </div>
          {agents.map((s) => (
            <div key={s.agent_id} className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-[150px]">
                <p className="text-white text-sm font-semibold">{AGENT_NAMES[s.agent_id] ?? s.agent_id}</p>
                <p className="text-[10px] text-gray-600">{DRAFT_ONLY.has(s.agent_id) ? "drafts only" : "autonomous"}</p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-400" title="Off = this agent never runs, even in Start All">
                <input type="checkbox" defaultChecked={s.enabled} onChange={(e) => saveSetting({ agent_id: s.agent_id, enabled: e.target.checked }, e.target.checked ? "Agent switched on." : "Agent switched off — Start All will skip it.")} className="accent-blue-600" /> on
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400" title="Most items it may produce in one run — keeps your queue reviewable">
                max <input type="number" defaultValue={s.output_cap} onBlur={(e) => saveSetting({ agent_id: s.agent_id, output_cap: Number(e.target.value) })} className="w-14 bg-gray-950 border border-gray-700 rounded px-1.5 py-1 text-white" /> items/run
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400" title="Its spending budget for one run">
                $<input type="number" step="0.5" defaultValue={s.usage_cap_usd} onBlur={(e) => saveSetting({ agent_id: s.agent_id, usage_cap_usd: Number(e.target.value) })} className="w-14 bg-gray-950 border border-gray-700 rounded px-1.5 py-1 text-white" />/run
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400" title="Optional — off means it ONLY runs when you press a button">
                schedule
                <select defaultValue={s.schedule ?? ""} onChange={(e) => saveSetting({ agent_id: s.agent_id, schedule: e.target.value || null }, e.target.value ? "Scheduled — it will run itself at that time every day (ET)." : "Schedule off — manual only.")} className="bg-gray-950 border border-gray-700 rounded px-1.5 py-1 text-white">
                  <option value="">off — manual only</option>
                  <option value="daily@07:00">every day, 7:00 AM ET</option>
                  <option value="daily@12:00">every day, noon ET</option>
                  <option value="daily@18:00">every day, 6:00 PM ET</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      )}

      {/* ── Tour overlay ── */}
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
