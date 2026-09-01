"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// ── Agent Flow: the review queue + control center for the marketing agents ──
// Everything here talks to /api/admin/agents/* (admin-gated, service-role
// underneath). Until supabase/agent-flow.sql has been run it renders the
// setup card instead of looking broken.

type Settings = { agent_id: string; enabled: boolean; paused: boolean; output_cap: number; usage_cap_usd: number; schedule: string | null };
type RunRow = { id: string; agent_id: string; status: string; started_at: string; finished_at: string | null; output_count: number; usage_usd: number; summary: string | null; trigger: string };
type Item = { id: string; agent_id: string; item_type: string; platform: string | null; target: string | null; target_url: string | null; title: string; content: string | null; context: string | null; status: string; payload: Record<string, unknown> | null; created_at: string };
type Board = { ready: boolean; message?: string; settings: Settings[]; system: { paused: boolean; monthly_usage_cap_usd: number; digest_email: string }; latestRuns: Record<string, RunRow>; recentRuns: RunRow[]; pendingBy: Record<string, number>; pendingTotal: number; spendBy: Record<string, number>; dispatchConfigured: boolean };

const AGENT_NAMES: Record<string, string> = {
  outreach: "Outreach Scout", prospects: "Link-in-bio Prospects", seo: "SEO", blog: "Blog Writer",
  social: "Social Content", mentions: "Mentions Monitor", influencer: "Influencer Scout",
  bugwatch: "Bug Watch", security: "Security Watch", manager: "Manager / Digest",
};
const DRAFT_ONLY = new Set(["outreach", "prospects", "social", "mentions", "influencer"]);

function ago(iso: string | null) {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
function stateOf(r?: RunRow, s?: Settings): { label: string; cls: string } {
  if (s && !s.enabled) return { label: "Disabled", cls: "bg-gray-800 text-gray-500" };
  if (s?.paused) return { label: "Paused", cls: "bg-amber-900/40 text-amber-400" };
  if (!r) return { label: "Idle", cls: "bg-gray-800 text-gray-400" };
  if (r.status === "running") return { label: "Running", cls: "bg-blue-900/50 text-blue-300 animate-pulse" };
  if (r.status === "failed") return { label: "Failed", cls: "bg-red-900/50 text-red-400" };
  if (r.status === "paused") return { label: "Paused mid-run", cls: "bg-amber-900/40 text-amber-400" };
  if (r.status.startsWith("skipped")) return { label: r.status === "skipped_cap" ? "Cap hit" : "Skipped", cls: "bg-amber-900/40 text-amber-400" };
  return { label: "Complete", cls: "bg-emerald-900/40 text-emerald-400" };
}

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
  const [history, setHistory] = useState<Array<{ id: string; action: string; actor_email: string; created_at: string; outcome: string | null; agent_queue_items: { agent_id: string; item_type: string; title: string; status: string } | null }>>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    const b = await fetch("/api/admin/agents").then((r) => r.json()).catch(() => null);
    setBoard(b);
    if (b?.ready) {
      const q = new URLSearchParams({ status: filterStatus });
      if (filterAgent) q.set("agent", filterAgent);
      if (filterType) q.set("type", filterType);
      const d = await fetch(`/api/admin/agents/items?${q}`).then((r) => r.json()).catch(() => null);
      setItems(d?.items ?? []);
    }
  }, [filterAgent, filterType, filterStatus]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + 30s poll; load() is the auto-refresh the spec asks for
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (view === "history") fetch("/api/admin/agents/history").then((r) => r.json()).then((d) => setHistory(d.history ?? [])).catch(() => {}); }, [view, items]);

  const control = async (op: string, agent_id?: string) => {
    setBusy(true);
    const r = await fetch("/api/admin/agents/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, agent_id }) }).then((r) => r.json()).catch(() => ({ error: "network" }));
    setBusy(false);
    say(r.error ? `⚠ ${r.error}` : op === "pause_all" ? "System paused — in-flight agents stop at their next checkpoint." : op === "start_all" ? "Dispatched every enabled agent." : "Done.");
    load();
  };
  const act = async (ids: string[], action: string, content?: string) => {
    if (!ids.length) return;
    await fetch("/api/admin/agents/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action, content }) });
    setSelected(new Set()); setEditing(null); load();
  };
  const saveSetting = async (patch: Record<string, unknown>) => {
    await fetch("/api/admin/agents/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    load();
  };
  const copyApprove = async (it: Item) => {
    try { await navigator.clipboard.writeText(it.content ?? ""); say("Copied to clipboard — paste it into the platform."); } catch { say("Copy failed — select the text manually."); }
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
    say(`CSV downloaded — ${rows.length} prospect(s).`);
  };

  if (board && !board.ready) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 max-w-2xl">
        <p className="text-white font-bold">Agent Flow isn&apos;t set up yet</p>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">{board.message} Nothing has run and nothing is broken — the agent tables just don&apos;t exist yet. After running the SQL, refresh this page; then use <span className="text-gray-200 font-semibold">Start All</span> or a per-agent <span className="text-gray-200 font-semibold">Run now</span> below to produce the first items.</p>
        <p className="text-gray-500 text-xs mt-3">Schema file: <code className="text-gray-300">supabase/agent-flow.sql</code> · Full setup: <code className="text-gray-300">marketing-agents/README.md</code></p>
      </div>
    );
  }
  if (!board) return <div className="text-gray-500 text-sm">Loading…</div>;

  const agents = board.settings ?? [];
  const pendingProspects = items.filter((i) => i.item_type === "prospect" && i.status === "pending");

  return (
    <div className="space-y-5">
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-700 text-white text-sm px-4 py-2 rounded-full shadow-xl">{toast}</div>}

      {/* Run controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => control("start_all")} disabled={busy || board.system.paused} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-colors">▶ Start All</button>
        {board.system.paused ? (
          <button onClick={() => control("resume_all")} disabled={busy} className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-colors">Resume system</button>
        ) : (
          <button onClick={() => control("pause_all")} disabled={busy} className="bg-amber-700 hover:bg-amber-600 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-colors">⏸ Pause All</button>
        )}
        {!board.dispatchConfigured && <span className="text-amber-400 text-xs">⚠ Run buttons need GITHUB_AGENTS_TOKEN in Vercel (see marketing-agents/README.md)</span>}
        {board.system.paused && <span className="text-amber-400 text-xs font-semibold">SYSTEM PAUSED — nothing will start; in-flight agents stop at their next checkpoint.</span>}
        <div className="ml-auto flex gap-1">
          {(["queue", "status", "history", "settings"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${view === v ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
              {v}{v === "queue" && board.pendingTotal > 0 ? ` (${board.pendingTotal})` : ""}
            </button>
          ))}
        </div>
      </div>

      {view === "status" && (
        <div className="grid gap-2">
          {agents.map((s) => {
            const r = board.latestRuns[s.agent_id];
            const st = stateOf(r, s);
            const bad = st.label === "Failed" || st.label === "Cap hit";
            return (
              <div key={s.agent_id} className={`rounded-xl border p-4 flex flex-wrap items-center gap-3 ${bad ? "border-red-800/60 bg-red-950/20" : "border-gray-800 bg-gray-900"}`}>
                <div className="min-w-[150px]">
                  <p className="text-white text-sm font-semibold">{AGENT_NAMES[s.agent_id] ?? s.agent_id}</p>
                  <p className="text-[10px] uppercase tracking-wide text-gray-600">{DRAFT_ONLY.has(s.agent_id) ? "draft-only" : s.agent_id === "manager" ? "reporter" : "autonomous drafts"}</p>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                <div className="text-xs text-gray-500 flex-1 min-w-[200px]">
                  <span>last run {ago(r?.started_at ?? null)} · {r ? `${r.output_count} item(s) · $${Number(r.usage_usd).toFixed(2)}` : "never run"} · month ${Number(board.spendBy[s.agent_id] ?? 0).toFixed(2)}</span>
                  {r?.summary && <p className={`mt-0.5 truncate ${r.status === "running" ? "text-blue-300" : "text-gray-600"}`}>{r.status === "running" ? "⋯ " : ""}{r.summary}</p>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => control("run", s.agent_id)} disabled={busy || s.paused || !s.enabled} className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-full transition-colors">Run now</button>
                  <button onClick={() => control(s.paused ? "resume" : "pause", s.agent_id)} disabled={busy} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition-colors">{s.paused ? "Resume" : "Pause"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "queue" && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5">
              {["pending", "approved", "rejected", "contacted", "published", "acknowledged", "converted"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5">
              <option value="">All agents</option>
              {Object.entries(AGENT_NAMES).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5">
              <option value="">All types</option>
              {["outreach_draft", "prospect", "reply_draft", "influencer", "video_script", "blog_post", "seo_report", "security_finding", "digest", "generic"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <button onClick={load} className="text-xs text-gray-400 hover:text-white px-2 py-1.5 transition-colors">↻ Refresh</button>
            {selected.size > 0 && (
              <div className="flex gap-1.5 ml-auto">
                <span className="text-xs text-gray-500 self-center">{selected.size} selected</span>
                <button onClick={() => act([...selected], "approved")} className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full">Approve all</button>
                <button onClick={() => act([...selected], "rejected")} className="text-xs bg-red-900 hover:bg-red-800 text-white px-3 py-1.5 rounded-full">Reject all</button>
              </div>
            )}
            {pendingProspects.length > 0 && <button onClick={() => downloadCsv(pendingProspects)} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full ml-auto">⬇ Prospects CSV ({pendingProspects.length})</button>}
          </div>

          {items.length === 0 && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
              <p className="text-gray-300 font-semibold">Nothing {filterStatus === "pending" ? "waiting for review" : `with status “${filterStatus}”`}.</p>
              <p className="text-gray-500 text-sm mt-1.5">Agents only run when you trigger them — use <button onClick={() => setView("status")} className="text-blue-400 underline">Run now / Start All</button> and results land here.</p>
            </div>
          )}

          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <div className="flex flex-wrap items-start gap-2">
                  {it.status === "pending" && (
                    <input type="checkbox" checked={selected.has(it.id)} onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(it.id); else n.delete(it.id); setSelected(n); }} className="mt-1 accent-blue-600" />
                  )}
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-blue-400">{AGENT_NAMES[it.agent_id] ?? it.agent_id}</span>
                      <span className="text-[10px] text-gray-600">{it.item_type}{it.platform ? ` · ${it.platform}` : ""} · {ago(it.created_at)}</span>
                    </div>
                    <p className="text-white text-sm font-semibold mt-1">{it.title}</p>
                    {it.target_url && <a href={it.target_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline break-all">{it.target_url}</a>}
                    {it.context && <p className="text-gray-500 text-xs mt-1.5 whitespace-pre-wrap">{it.context}</p>}
                    {editing === it.id ? (
                      <div className="mt-2">
                        <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={8} className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-gray-200 text-sm font-mono" />
                        <div className="flex gap-2 mt-1.5">
                          <button onClick={() => act([it.id], "edited", editText)} className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-full">Save edit</button>
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
                        <button onClick={() => copyApprove(it)} className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full">Approve &amp; Copy</button>
                      )}
                      {it.item_type === "video_script" && (
                        <button onClick={() => copyApprove(it)} className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full">Copy to Higgsfield</button>
                      )}
                      {it.item_type === "blog_post" && (
                        <button onClick={() => act([it.id], "published")} className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full">Publish</button>
                      )}
                      {it.item_type === "prospect" && (
                        <button onClick={() => act([it.id], "contacted")} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full">Mark contacted</button>
                      )}
                      {it.item_type === "security_finding" && (
                        <button onClick={() => act([it.id], "acknowledged")} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full">Acknowledge</button>
                      )}
                      {(it.item_type === "seo_report" || it.item_type === "digest") && (
                        <button onClick={() => act([it.id], "acknowledged")} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full">Acknowledge</button>
                      )}
                      {it.payload && "pr_url" in (it.payload as object) && (
                        <a href={String((it.payload as Record<string, unknown>).pr_url)} target="_blank" rel="noreferrer" className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full text-center">View PR</a>
                      )}
                      {(it.item_type === "outreach_draft" || it.item_type === "reply_draft" || it.item_type === "influencer" || it.item_type === "video_script" || it.item_type === "blog_post" || it.item_type === "generic") && (
                        <button onClick={() => { setEditing(it.id); setEditText(it.content ?? ""); }} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full">Edit</button>
                      )}
                      <button onClick={() => act([it.id], "rejected")} className="text-xs text-red-400 hover:text-red-300 px-3 py-1">Reject</button>
                    </div>
                  )}
                  {it.status === "approved" && (it.item_type === "outreach_draft" || it.item_type === "reply_draft" || it.item_type === "influencer") && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={() => act([it.id], "contacted")} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full">Mark sent</button>
                      <button onClick={() => act([it.id], "replied")} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-full">Got a reply</button>
                      <button onClick={() => act([it.id], "converted")} className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full">Converted 🎉</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {view === "history" && (
        <div className="space-y-1.5">
          {history.length === 0 && <p className="text-gray-500 text-sm">No actions yet — approve or reject something and it lands here.</p>}
          {history.map((h) => (
            <div key={h.id} className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2.5 flex flex-wrap items-center gap-2 text-xs">
              <span className={`font-bold uppercase ${h.action === "approved" || h.action === "published" ? "text-emerald-400" : h.action === "rejected" ? "text-red-400" : "text-gray-400"}`}>{h.action}</span>
              <span className="text-gray-300 flex-1 min-w-[200px]">{h.agent_queue_items?.title ?? "(deleted item)"}</span>
              <span className="text-gray-600">{h.agent_queue_items?.agent_id} · {ago(h.created_at)}{h.outcome ? ` · outcome: ${h.outcome}` : ""}</span>
            </div>
          ))}
        </div>
      )}

      {view === "settings" && (
        <div className="space-y-2 max-w-3xl">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex flex-wrap items-center gap-3">
            <p className="text-white text-sm font-semibold flex-1">System · monthly usage cap</p>
            <input type="number" step="1" defaultValue={board.system.monthly_usage_cap_usd} onBlur={(e) => saveSetting({ system: { monthly_usage_cap_usd: Number(e.target.value) } })} className="w-24 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm" />
            <span className="text-gray-500 text-xs">USD — agents refuse to start past this and email you</span>
          </div>
          {agents.map((s) => (
            <div key={s.agent_id} className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex flex-wrap items-center gap-3">
              <p className="text-white text-sm font-semibold min-w-[150px]">{AGENT_NAMES[s.agent_id] ?? s.agent_id}</p>
              <label className="flex items-center gap-1.5 text-xs text-gray-400">
                <input type="checkbox" defaultChecked={s.enabled} onChange={(e) => saveSetting({ agent_id: s.agent_id, enabled: e.target.checked })} className="accent-blue-600" /> enabled
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400">cap
                <input type="number" defaultValue={s.output_cap} onBlur={(e) => saveSetting({ agent_id: s.agent_id, output_cap: Number(e.target.value) })} className="w-16 bg-gray-950 border border-gray-700 rounded px-1.5 py-1 text-white" /> items
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400">$
                <input type="number" step="0.5" defaultValue={s.usage_cap_usd} onBlur={(e) => saveSetting({ agent_id: s.agent_id, usage_cap_usd: Number(e.target.value) })} className="w-16 bg-gray-950 border border-gray-700 rounded px-1.5 py-1 text-white" /> / run
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400">schedule
                <input placeholder="off (e.g. 0 7 * * *)" defaultValue={s.schedule ?? ""} onBlur={(e) => saveSetting({ agent_id: s.agent_id, schedule: e.target.value || null })} className="w-32 bg-gray-950 border border-gray-700 rounded px-1.5 py-1 text-white" />
              </label>
            </div>
          ))}
          <p className="text-gray-600 text-xs">Schedules are cron in UTC, OFF by default. Setting one arms the half-hourly scheduler workflow for that agent only.</p>
        </div>
      )}
    </div>
  );
}
