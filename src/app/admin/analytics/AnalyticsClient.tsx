"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Analytics = {
  accounts: { total: number; today: number; d7: number; d30: number; series: { date: string; count: number }[]; recent: { name: string; email: string; username: string; plan: string; created_at: string }[] };
  plans: { free: number; pro: number; office: number; paid: number; conversion: number; estMrr: number };
  acquisition: { source: string; signups: number; d30: number; paid: number; paidRate: number }[];
  cards: { total: number; perAccount: number };
  leads: { total: number; today: number; d7: number; series: { date: string; count: number }[]; bySource: [string, number][]; perAccount: number };
  views: { total: number; d7: number; cardViews30: number; linkViews30: number };
  engagement: { activatedCards: number; activationRate: number };
  topCards: { username: string; count: number }[];
};

const PLAN_LABEL: Record<string, string> = { free: "Free", pro: "Pro", enterprise: "Office", office: "Office" };
const PLAN_COLOR: Record<string, string> = { free: "#6b7280", pro: "#60a5fa", office: "#c084fc" };

function Kpi({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-4">
      <p className="text-2xl font-bold tabular-nums" style={accent ? { color: accent } : undefined}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
      {sub && <p className="text-gray-600 text-[11px] mt-0.5">{sub}</p>}
    </div>
  );
}

function BarChart({ series, color = "#3b82f6" }: { series: { date: string; count: number }[]; color?: string }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  return (
    <div className="flex items-end gap-[3px] h-24">
      {series.map((s) => (
        <div key={s.date} className="flex-1 group relative flex flex-col justify-end">
          <div className="rounded-t-sm transition-colors" style={{ height: `${(s.count / max) * 100}%`, minHeight: s.count ? 3 : 0, background: color }} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
            {new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}: {s.count}
          </div>
        </div>
      ))}
    </div>
  );
}

function Bars({ rows, color = "#3b82f6" }: { rows: [string, number][]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <p className="text-gray-600 text-xs">No data yet.</p>;
  return (
    <div className="space-y-2">
      {rows.map(([label, n]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-gray-300 text-xs w-28 shrink-0 truncate capitalize">{label.replace(/_/g, " ")}</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: color }} />
          </div>
          <span className="text-gray-400 text-xs w-10 text-right tabular-nums">{n.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsClient() {
  const [a, setA] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then(setA)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Company analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Growth, revenue, engagement, and where users come from.</p>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm py-10 text-center">Loading analytics…</p>
        ) : error || !a ? (
          <p className="text-red-400 text-sm py-10 text-center">{error ?? "No data"}</p>
        ) : (
          <div className="space-y-8">
            {/* Headline KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi label="Total accounts" value={a.accounts.total} sub={`+${a.accounts.d30} in 30d · +${a.accounts.today} today`} />
              <Kpi label="Paid customers" value={a.plans.paid} sub={`${a.plans.conversion}% conversion`} accent="#60a5fa" />
              <Kpi label="Est. MRR" value={`$${a.plans.estMrr.toLocaleString()}`} sub="Pro + Office / month" accent="#4ade80" />
              <Kpi label="Contacts captured" value={a.leads.total} sub={`+${a.leads.d7} this week`} />
            </div>

            {/* Growth */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-semibold text-sm">New accounts · last 30 days</p>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Today <span className="text-white font-semibold">{a.accounts.today}</span></span>
                  <span>7d <span className="text-white font-semibold">{a.accounts.d7}</span></span>
                  <span>30d <span className="text-white font-semibold">{a.accounts.d30}</span></span>
                </div>
              </div>
              <BarChart series={a.accounts.series} color="#3b82f6" />
            </div>

            {/* Plans + Sources */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-white font-semibold text-sm mb-4">Plan mix</p>
                <Bars rows={[["Free", a.plans.free], ["Pro", a.plans.pro], ["Office", a.plans.office]]} color="#8b5cf6" />
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[["Free", a.plans.free, "#6b7280"], ["Pro", a.plans.pro, "#60a5fa"], ["Office", a.plans.office, "#c084fc"]].map(([l, n, c]) => (
                    <div key={l as string} className="bg-gray-800/40 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-lg font-bold tabular-nums" style={{ color: c as string }}>{(n as number).toLocaleString()}</p>
                      <p className="text-gray-500 text-[11px]">{l as string}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-white font-semibold text-sm mb-4">Where contacts come from <span className="text-gray-600 font-normal">· last 30d</span></p>
                <Bars rows={a.leads.bySource} color="#22c55e" />
              </div>
            </div>

            {/* Contacts trend */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-semibold text-sm">Contacts captured · last 30 days</p>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Today <span className="text-white font-semibold">{a.leads.today}</span></span>
                  <span>7d <span className="text-white font-semibold">{a.leads.d7}</span></span>
                </div>
              </div>
              <BarChart series={a.leads.series} color="#22c55e" />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi label="Total cards" value={a.cards.total} sub={`${a.cards.perAccount} per account`} />
              <Kpi label="Total views" value={a.views.total} sub={`+${a.views.d7} this week`} />
              <Kpi label="SwiftCard vs Links (30d)" value={`${a.views.cardViews30} / ${a.views.linkViews30}`} sub="card views / link views" />
              <Kpi label="Card activation" value={`${a.engagement.activationRate}%`} sub={`${a.engagement.activatedCards.toLocaleString()} cards got a lead`} />
            </div>

            {/* Top cards + recent signups */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-white font-semibold text-sm mb-3">Top cards by contacts</p>
                {a.topCards.length === 0 ? <p className="text-gray-600 text-xs">No contacts yet.</p> : (
                  <div className="divide-y divide-gray-800/60">
                    {a.topCards.map((c, i) => (
                      <div key={c.username} className="flex items-center justify-between py-2 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-600 text-xs w-4">{i + 1}</span>
                          <a href={`/card/${c.username.replace("__links", "")}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate">/{c.username}</a>
                        </span>
                        <span className="text-white font-semibold tabular-nums shrink-0">{c.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-white font-semibold text-sm mb-3">Latest signups</p>
                <div className="divide-y divide-gray-800/60">
                  {a.accounts.recent.map((u) => (
                    <div key={u.username} className="flex items-center justify-between py-2 text-sm">
                      <span className="min-w-0">
                        <span className="text-white truncate block max-w-[180px]">{u.name || u.username}</span>
                        <span className="text-gray-600 text-[11px] truncate block max-w-[180px]">{u.email}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: (PLAN_COLOR[u.plan === "enterprise" ? "office" : u.plan] ?? "#6b7280") + "22", color: PLAN_COLOR[u.plan === "enterprise" ? "office" : u.plan] ?? "#9ca3af" }}>{PLAN_LABEL[u.plan] ?? "Free"}</span>
                        <span className="text-gray-600 text-[11px]">{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Acquisition — where signups come from and which sources convert to paid */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-white font-semibold text-sm mb-1">Acquisition — where signups come from</p>
              <p className="text-gray-600 text-[11px] mb-4">Use the paid-conversion column to decide where marketing money works hardest.</p>
              {a.acquisition.length === 0 ? (
                <p className="text-gray-600 text-xs">No signups yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500 text-xs">
                        <th className="text-left py-2 font-medium">Source</th>
                        <th className="text-right py-2 font-medium">Signups</th>
                        <th className="text-right py-2 font-medium">Last 30d</th>
                        <th className="text-right py-2 font-medium">Went paid</th>
                        <th className="text-right py-2 font-medium">Paid rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {a.acquisition.map((row) => (
                        <tr key={row.source}>
                          <td className="py-2 text-gray-300 text-xs capitalize">{row.source.replace(/_/g, " ")}</td>
                          <td className="py-2 text-right text-white font-semibold tabular-nums">{row.signups.toLocaleString()}</td>
                          <td className="py-2 text-right text-gray-400 tabular-nums">{row.d30.toLocaleString()}</td>
                          <td className="py-2 text-right text-gray-400 tabular-nums">{row.paid.toLocaleString()}</td>
                          <td className="py-2 text-right tabular-nums font-semibold" style={{ color: row.paidRate > 0 ? "#4ade80" : "#6b7280" }}>{row.paidRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="text-gray-600 text-[11px] text-center">Referral & fraud analytics live in <Link href="/admin/referrals" className="text-blue-400 hover:text-blue-300">Referrals</Link>. Est. MRR uses list prices; excludes discounts &amp; Office seat counts.</p>
          </div>
        )}
    </div>
  );
}
