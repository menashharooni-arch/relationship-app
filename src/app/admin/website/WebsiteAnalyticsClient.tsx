"use client";

import { useCallback, useEffect, useState } from "react";

type Data = {
  includeInternal: boolean;
  capHit: boolean;
  kpis: {
    pageviews: { d1: number; d7: number; d30: number };
    visitors: { d1: number; d7: number; d30: number };
    sessions: number;
    pagesPerSession: number;
    avgDurationSec: number;
    bounceRatePct: number;
  };
  daily: { date: string; views: number; visitors: number }[];
  topPages: { label: string; count: number }[];
  topReferrers: { label: string; count: number }[];
  topCountries: { label: string; count: number }[];
};

function fmt(n: number) { return n.toLocaleString("en-US"); }
function duration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wide">{label}</p>
      <p className="text-white text-2xl font-bold tabular-nums mt-1">{value}</p>
      {sub && <p className="text-gray-500 text-[11px] mt-0.5">{sub}</p>}
    </div>
  );
}

function DualChart({ series }: { series: Data["daily"] }) {
  const max = Math.max(1, ...series.map((s) => s.views));
  return (
    <div className="flex items-end gap-1 h-40">
      {series.map((s) => (
        <div key={s.date} className="group relative flex-1 min-w-0 h-full flex flex-col justify-end items-center">
          {/* pageviews (faint) with unique visitors (solid) layered in front */}
          <div className="relative w-full flex justify-center" style={{ height: "100%" }}>
            <div className="absolute bottom-0 w-full rounded-t-sm" style={{ height: `${(s.views / max) * 100}%`, minHeight: s.views ? 3 : 0, background: "#1e3a8a" }} />
            <div className="absolute bottom-0 w-full rounded-t-sm" style={{ height: `${(s.visitors / max) * 100}%`, minHeight: s.visitors ? 3 : 0, background: "#3b82f6" }} />
          </div>
          <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-center shadow-lg ring-1 ring-black/20">
            <span suppressHydrationWarning className="block text-[10px] text-slate-400">{new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            <span className="block text-[11px] font-bold text-white tabular-nums">{fmt(s.views)} views</span>
            <span className="block text-[11px] font-semibold text-blue-300 tabular-nums">{fmt(s.visitors)} visitors</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TopList({ title, rows, empty }: { title: string; rows: { label: string; count: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-white font-semibold text-sm mb-3">{title}</p>
      {rows.length === 0 ? (
        <p className="text-gray-600 text-xs">{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="relative flex items-center justify-between gap-3 rounded-md px-2 py-1.5 overflow-hidden">
              <div className="absolute inset-y-0 left-0 rounded-md bg-blue-600/15" style={{ width: `${(r.count / max) * 100}%` }} />
              <span className="relative text-gray-300 text-xs truncate">{r.label}</span>
              <span className="relative text-white font-semibold text-xs tabular-nums shrink-0">{fmt(r.count)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WebsiteAnalyticsClient({ initialInternalDevice }: { initialInternalDevice: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [includeInternal, setIncludeInternal] = useState(false);
  const [internalDevice, setInternalDevice] = useState(initialInternalDevice);
  const [savingDevice, setSavingDevice] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(false);
    try {
      const res = await fetch(`/api/admin/website?internal=${includeInternal ? "1" : "0"}`);
      if (!res.ok) { setErr(true); return; }
      setData(await res.json());
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  }, [includeInternal]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount + when the internal-filter toggle changes; load() owns its own loading/error state
  useEffect(() => { load(); }, [load]);

  async function toggleDevice() {
    const next = !internalDevice;
    setSavingDevice(true);
    try {
      const res = await fetch("/api/admin/website/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: next }),
      });
      if (res.ok) setInternalDevice(next);
    } finally {
      setSavingDevice(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Website analytics</h1>
          <p className="text-gray-500 text-xs mt-0.5">Traffic to the marketing site — home, pricing, product & preview pages. The app, admin, and shared cards aren&apos;t counted here.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400 select-none cursor-pointer">
          <input type="checkbox" checked={includeInternal} onChange={(e) => setIncludeInternal(e.target.checked)} className="accent-blue-600" />
          Include my team&apos;s visits
        </label>
      </div>

      {/* Exclude-this-device control */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6 rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm text-white font-medium">
            {internalDevice ? "This device is excluded from analytics" : "This device is counted in analytics"}
          </p>
          <p className="text-gray-500 text-[11px] mt-0.5">
            Turn this on wherever you and your partner browse the site, so your own visits don&apos;t inflate the numbers.
          </p>
        </div>
        <button
          onClick={toggleDevice}
          disabled={savingDevice}
          className={`shrink-0 text-xs font-semibold px-4 py-2 rounded-full transition-colors disabled:opacity-50 ${
            internalDevice ? "bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700" : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {savingDevice ? "Saving…" : internalDevice ? "Count this device again" : "Exclude my visits"}
        </button>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {err && (
        <p className="text-gray-400 text-sm">Couldn&apos;t load analytics. <button onClick={load} className="text-blue-400 hover:text-blue-300">Retry</button></p>
      )}

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Kpi label="Visitors today" value={fmt(data.kpis.visitors.d1)} sub={`${fmt(data.kpis.pageviews.d1)} views`} />
            <Kpi label="Visitors · 7d" value={fmt(data.kpis.visitors.d7)} sub={`${fmt(data.kpis.pageviews.d7)} views`} />
            <Kpi label="Visitors · 30d" value={fmt(data.kpis.visitors.d30)} sub={`${fmt(data.kpis.pageviews.d30)} views`} />
            <Kpi label="Avg. time on page" value={duration(data.kpis.avgDurationSec)} />
            <Kpi label="Pages / session" value={String(data.kpis.pagesPerSession)} sub={`${fmt(data.kpis.sessions)} sessions · 30d`} />
            <Kpi label="Bounce rate" value={`${data.kpis.bounceRatePct}%`} sub="single-page sessions" />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">Last 30 days</p>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#3b82f6" }} /> Unique visitors</span>
                <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#1e3a8a" }} /> Pageviews</span>
              </div>
            </div>
            <DualChart series={data.daily} />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <TopList title="Top pages" rows={data.topPages} empty="No pageviews yet." />
            <TopList title="Top referrers" rows={data.topReferrers} empty="No external referrers yet — traffic is direct." />
            <TopList title="Top countries" rows={data.topCountries} empty="No location data yet." />
          </div>

          {data.capHit && (
            <p className="text-amber-500/70 text-[11px] mt-4">Charts reflect the most recent 50,000 pageviews (window is busier than that).</p>
          )}
        </>
      )}
    </div>
  );
}
