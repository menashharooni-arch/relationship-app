"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Data = {
  rangeDays: number;
  totalViews: number;
  totalSaves: number;
  conversionRate: number;
  bestDay: { date: string; views: number } | null;
  series: { date: string; views: number }[];
  sources: { source: string; label: string; count: number }[];
  locations: { location: string; count: number }[];
};

const box = "bg-gray-900 border border-gray-800/80 rounded-2xl p-5";

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Compact area sparkline of daily views, with the peak day emphasized.
function Sparkline({ series }: { series: { date: string; views: number }[] }) {
  const W = 640, H = 90, pad = 4;
  const max = Math.max(1, ...series.map((s) => s.views));
  const n = series.length;
  const x = (i: number) => (n <= 1 ? 0 : pad + (i * (W - pad * 2)) / (n - 1));
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(s.views).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const peakIdx = series.reduce((p, s, i) => (s.views > series[p].views ? i : p), 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-16" role="img" aria-label="Views over time">
      <defs>
        <linearGradient id="sc-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sc-spark)" />
      <path d={line} fill="none" stroke="#60a5fa" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {series[peakIdx].views > 0 && (
        <circle cx={x(peakIdx)} cy={y(series[peakIdx].views)} r="3.5" fill="#93c5fd" stroke="#0b1220" strokeWidth="1.5" />
      )}
    </svg>
  );
}

export default function ProAnalytics({ username }: { username: string }) {
  const [range, setRange] = useState<7 | 30>(30);
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    fetch(`/api/analytics/pro?card=${encodeURIComponent(username)}&range=${range}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: Data) => { if (alive) { setData(d); setStatus("ok"); } })
      .catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; };
  }, [username, range]);

  const maxSource = Math.max(1, ...(data?.sources ?? []).map((s) => s.count));
  const maxLoc = Math.max(1, ...(data?.locations ?? []).map((l) => l.count));

  return (
    <div className={`${box} mb-5`}>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-white font-semibold text-sm">Full analytics</p>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30">PRO</span>
        </div>
        <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
          {([7, 30] as const).map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${range === r ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      {status === "loading" && <p className="text-gray-600 text-sm py-8 text-center">Loading analytics…</p>}
      {status === "error" && <p className="text-gray-600 text-sm py-8 text-center">Couldn&apos;t load analytics. Try again shortly.</p>}

      {status === "ok" && data && (
        <div className="space-y-5">
          {/* Headline stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Views", value: data.totalViews.toLocaleString(), sub: `last ${data.rangeDays} days` },
              { label: "Contacts", value: data.totalSaves.toLocaleString(), sub: "captured" },
              { label: "Conversion", value: `${(data.conversionRate * 100).toFixed(data.conversionRate >= 0.1 ? 0 : 1)}%`, sub: "views → contacts" },
            ].map((s) => (
              <div key={s.label} className="bg-gray-800/40 border border-gray-800 rounded-xl px-3 py-3">
                <p className="text-xl font-bold text-white tabular-nums">{s.value}</p>
                <p className="text-gray-300 text-xs font-medium mt-0.5">{s.label}</p>
                <p className="text-gray-600 text-[10px]">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Views over time */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-gray-400 text-xs font-medium">Views over time</p>
              {data.bestDay && data.bestDay.views > 0 && (
                <p className="text-gray-500 text-[11px]">Best day: <span className="text-gray-300">{fmtDate(data.bestDay.date)}</span> · {data.bestDay.views}</p>
              )}
            </div>
            <Sparkline series={data.series} />
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {/* Traffic sources */}
            <div>
              <p className="text-gray-400 text-xs font-medium mb-2.5">Traffic sources</p>
              {data.sources.length === 0 ? (
                <p className="text-gray-600 text-xs">No contacts captured yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.sources.map((s) => (
                    <div key={s.source} className="flex items-center gap-2.5">
                      <span className="text-gray-300 text-xs w-24 shrink-0 truncate">{s.label}</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(s.count / maxSource) * 100}%` }} />
                      </div>
                      <span className="text-gray-400 text-xs w-6 text-right tabular-nums">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top locations */}
            <div>
              <p className="text-gray-400 text-xs font-medium mb-2.5">Top locations</p>
              {data.locations.length === 0 ? (
                <p className="text-gray-600 text-xs">No location data yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.locations.map((l) => (
                    <div key={l.location} className="flex items-center gap-2.5">
                      <span className="text-gray-300 text-xs flex-1 truncate">📍 {l.location}</span>
                      <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden shrink-0">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(l.count / maxLoc) * 100}%` }} />
                      </div>
                      <span className="text-gray-400 text-xs w-6 text-right tabular-nums">{l.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Free-plan teaser in the same slot — the segmented analytics are Pro.
export function ProAnalyticsLocked() {
  return (
    <div className={`${box} mb-5`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-white font-semibold text-sm">Full analytics</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">PRO</span>
          </div>
          <p className="text-gray-500 text-xs leading-relaxed max-w-md">
            See which channels drive your contacts (QR, link, bio, email signature), where your audience is, and your views-to-contacts conversion rate.
          </p>
        </div>
        <Link href="/pricing" className="shrink-0 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-full transition-colors">
          Unlock with Pro →
        </Link>
      </div>
    </div>
  );
}
