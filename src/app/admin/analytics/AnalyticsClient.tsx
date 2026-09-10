"use client";

import { useEffect, useState } from "react";
import { getSignupSourceLabel, getSourceLabel } from "@/lib/source-labels";
import Link from "next/link";

type Analytics = {
  /** Ingest DECISIONS, not traffic — see lib/ingest-log.ts. `available: false`
   *  means supabase/analytics-accuracy.sql hasn't been run yet. */
  ingest?: {
    available: boolean;
    byReason: [string, number][];
    byClassification: [string, number][];
    byGeoAccuracy: [string, number][];
    counted7: number;
    declined7: number;
    relay7: number;
    recentDeclines: { at: string; entity: string; event: string; reason: string; classification: string | null }[];
  };
  accounts: { total: number; today: number; d7: number; d30: number; series: { date: string; count: number }[]; recent: { name: string; email: string; username: string; plan: string; created_at: string }[] };
  plans: { free: number; pro: number; office: number; paid: number; conversion: number; estMrr: number; compedPaidPlans?: number };
  acquisition: { source: string; signups: number; d30: number; paid: number; paidRate: number }[];
  cards: { total: number; perAccount: number };
  leads: { total: number; today: number; d7: number; series: { date: string; count: number }[]; bySource: [string, number][]; perAccount: number };
  views: { total: number; d7: number; cardViews30: number; linkViews30: number };
  engagement: { activatedCards: number; activationRate: number };
  topCards: { username: string; count: number }[];
};

const PLAN_LABEL: Record<string, string> = { free: "Free", pro: "Pro", enterprise: "Office", office: "Office" };

// The ingest vocabulary in plain words. Written so the panel answers "why is
// that view missing?" without anyone having to open lib/ingest-log.ts.
const REASON_LABEL: Record<string, string> = {
  recorded: "Counted — a real visit",
  deduped: "Same visit again (reload / double-fire)",
  self: "The owner's own visit",
  inactive: "Card no longer serves",
  bot: "Bot, crawler or preview",
  prefetch: "Browser prefetch / prerender",
  rate_limited: "Over the per-IP cap",
  rejected: "Refused (bad event type)",
  error: "Write failed",
};
const CLASSIFICATION_LABEL: Record<string, string> = {
  human: "Human",
  crawler: "Crawler / unfurler",
  automation: "Headless browser",
  monitor: "Uptime monitor",
  http_client: "Scripted HTTP client",
  datacenter: "Datacenter network",
};
const GEO_LABEL: Record<string, string> = {
  city: "City — two databases agreed",
  city_approx: "Near a city — one source only",
  region: "Region only — sources disagreed",
  country: "Country only",
  "—": "No location",
};
const PLAN_COLOR: Record<string, string> = { free: "#6b7280", pro: "#60a5fa", office: "#c084fc" };

function Kpi({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-4">
      <p className="text-2xl font-bold tabular-nums" style={accent ? { color: accent } : undefined}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
      {sub && <p className="text-gray-600 text-[0.6875rem] mt-0.5">{sub}</p>}
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
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-[0.625rem] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
            {new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}: {s.count}
          </div>
        </div>
      ))}
    </div>
  );
}

function Bars({ rows, color = "#3b82f6", labeler }: { rows: [string, number][]; color?: string; labeler?: (key: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <p className="text-gray-600 text-xs">No data yet.</p>;
  return (
    <div className="space-y-2">
      {rows.map(([label, n]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-gray-300 text-xs w-36 shrink-0 truncate" title={labeler ? labeler(label) : label.replace(/_/g, " ")}>{labeler ? labeler(label) : label.replace(/_/g, " ")}</span>
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
              <Kpi
                label="Est. MRR"
                value={`$${a.plans.estMrr.toLocaleString()}`}
                sub={
                  a.plans.compedPaidPlans
                    ? `Stripe subscriptions only · ${a.plans.compedPaidPlans} comped`
                    : "Stripe subscriptions only"
                }
                accent="#4ade80"
              />
              <Kpi label="Contacts captured" value={a.leads.total} sub={`+${a.leads.d7} this week`} />
            </div>

            {/* Growth */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white font-semibold text-sm">New accounts · last 30 days</p>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Today <span className="text-white font-semibold">{a.accounts.today}</span></span>
                  <span>7d <span className="text-white font-semibold">{a.accounts.d7}</span></span>
                  <span>30d <span className="text-white font-semibold">{a.accounts.d30}</span></span>
                </div>
              </div>
              <p className="text-gray-600 text-[0.6875rem] mb-4">Signups per day — your growth curve. A flat stretch means marketing needs a push.</p>
              <BarChart series={a.accounts.series} color="#3b82f6" />
            </div>

            {/* Plans + Sources */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-white font-semibold text-sm mb-1">Plan mix</p>
                <p className="text-gray-600 text-[0.6875rem] mb-4">How many users sit on each plan — Free is your upgrade pipeline.</p>
                <Bars rows={[["Free", a.plans.free], ["Pro", a.plans.pro], ["Office", a.plans.office]]} color="#8b5cf6" />
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[["Free", a.plans.free, "#6b7280"], ["Pro", a.plans.pro, "#60a5fa"], ["Office", a.plans.office, "#c084fc"]].map(([l, n, c]) => (
                    <div key={l as string} className="bg-gray-800/40 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-lg font-bold tabular-nums" style={{ color: c as string }}>{(n as number).toLocaleString()}</p>
                      <p className="text-gray-500 text-[0.6875rem]">{l as string}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-white font-semibold text-sm mb-1">Where contacts come from <span className="text-gray-600 font-normal">· last 30d</span></p>
                <p className="text-gray-600 text-[0.6875rem] mb-4">Across ALL users: how people reached a card before sharing their info (QR scan, card link, bio link…).</p>
                <Bars rows={a.leads.bySource} color="#22c55e" labeler={getSourceLabel} />
              </div>
            </div>

            {/* Contacts trend */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white font-semibold text-sm">Contacts captured · last 30 days</p>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Today <span className="text-white font-semibold">{a.leads.today}</span></span>
                  <span>7d <span className="text-white font-semibold">{a.leads.d7}</span></span>
                </div>
              </div>
              <p className="text-gray-600 text-[0.6875rem] mb-4">New contacts landing in users&apos; CRMs per day — the clearest signal the product is delivering value.</p>
              <BarChart series={a.leads.series} color="#22c55e" />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi label="Total cards" value={a.cards.total} sub={`${a.cards.perAccount} per account`} />
              <Kpi label="Total views" value={a.views.total} sub={`+${a.views.d7} this week`} />
              <Kpi label="Views by surface (30d)" value={`${a.views.cardViews30} / ${a.views.linkViews30}`} sub="card pages / Swift Links pages" />
              <Kpi label="Card activation" value={`${a.engagement.activationRate}%`} sub={`${a.engagement.activatedCards.toLocaleString()} cards got a lead`} />
            </div>

            {/* Top cards + recent signups */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-white font-semibold text-sm mb-1">Top cards by contacts</p>
                <p className="text-gray-600 text-[0.6875rem] mb-3">The cards capturing the most contacts — your power users. Great candidates for testimonials and referrals.</p>
                {a.topCards.length === 0 ? <p className="text-gray-600 text-xs">No contacts yet.</p> : (
                  <div className="divide-y divide-gray-800/60">
                    {a.topCards.map((c, i) => (
                      <div key={c.username} className="flex items-center justify-between py-2 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-600 text-xs w-4">{i + 1}</span>
                          <a href={`/${c.username.replace("__links", "")}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate">/{c.username}</a>
                        </span>
                        <span className="text-white font-semibold tabular-nums shrink-0">{c.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-white font-semibold text-sm mb-1">Latest signups</p>
                <p className="text-gray-600 text-[0.6875rem] mb-3">The most recent accounts — click through in Users to see any of them in detail.</p>
                <div className="divide-y divide-gray-800/60">
                  {a.accounts.recent.map((u) => (
                    <div key={u.username} className="flex items-center justify-between py-2 text-sm">
                      <span className="min-w-0">
                        <span className="text-white truncate block max-w-[180px]">{u.name || u.username}</span>
                        <span className="text-gray-600 text-[0.6875rem] truncate block max-w-[180px]">{u.email}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-[0.625rem] font-bold px-2 py-0.5 rounded-full" style={{ background: (PLAN_COLOR[u.plan === "enterprise" ? "office" : u.plan] ?? "#6b7280") + "22", color: PLAN_COLOR[u.plan === "enterprise" ? "office" : u.plan] ?? "#9ca3af" }}>{PLAN_LABEL[u.plan] ?? "Free"}</span>
                        <span className="text-gray-600 text-[0.6875rem]">{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Acquisition — where signups come from and which sources convert to paid */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-white font-semibold text-sm mb-1">Acquisition — where signups come from</p>
              <p className="text-gray-600 text-[0.6875rem] mb-4">Use the paid-conversion column to decide where marketing money works hardest.</p>
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
                          <td className="py-2 text-gray-300 text-xs">{getSignupSourceLabel(row.source)}</td>
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

            {/* ── Ingest decisions ────────────────────────────────────────────
                Not a customer number and never summed into one: card_views is
                the one source of counted truth. This is the audit trail for the
                decisions that produce it, so "is that view real?" and "why is
                that view missing?" stop being arguments. 7-day window; the table
                itself keeps 14 days and trims itself. */}
            {a.ingest && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-white font-semibold text-sm">Ingest decisions · last 7 days</p>
                <p className="text-gray-600 text-[0.6875rem] mt-0.5 mb-4">
                  Why each tracked event was counted or not. Decisions only — customer dashboards read <span className="text-gray-500">card_views</span>, never this.
                </p>
                {!a.ingest.available ? (
                  <p className="text-amber-400/80 text-xs">
                    Not recording yet — run <span className="font-mono">supabase/analytics-accuracy.sql</span> in the Supabase SQL editor.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <Kpi label="Counted" value={a.ingest.counted7} accent="#4ade80" />
                      <Kpi label="Declined" value={a.ingest.declined7} sub="reasons below" />
                      <Kpi label="Relay / cloud network" value={a.ingest.relay7} sub="location downgraded, still counted" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <p className="text-gray-400 text-xs font-semibold mb-2">Decision</p>
                        <Bars rows={a.ingest.byReason} color="#60a5fa" labeler={(k) => REASON_LABEL[k] ?? k.replace(/_/g, " ")} />
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs font-semibold mb-2">What we thought it was</p>
                        <Bars rows={a.ingest.byClassification} color="#c084fc" labeler={(k) => CLASSIFICATION_LABEL[k] ?? k.replace(/_/g, " ")} />
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs font-semibold mb-2">Location confidence</p>
                        <Bars rows={a.ingest.byGeoAccuracy} color="#fbbf24" labeler={(k) => GEO_LABEL[k] ?? k.replace(/_/g, " ")} />
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs font-semibold mb-2">Most recent declines</p>
                        {a.ingest.recentDeclines.length === 0 ? (
                          <p className="text-gray-600 text-xs">Nothing declined in the window.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-44 overflow-y-auto">
                            {a.ingest.recentDeclines.map((d, i) => (
                              <div key={`${d.at}-${i}`} className="flex items-baseline gap-2 text-[0.6875rem]">
                                <span className="text-gray-600 tabular-nums shrink-0">{new Date(d.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                                <span className="text-gray-300 truncate">{d.entity}</span>
                                <span className="text-gray-500 shrink-0 ml-auto">{REASON_LABEL[d.reason] ?? d.reason}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <p className="text-gray-600 text-[0.6875rem] text-center">Referral & fraud analytics live in <Link href="/admin/referrals" className="text-blue-400 hover:text-blue-300">Referrals</Link>. Est. MRR uses list prices; excludes discounts &amp; Office seat counts.</p>
          </div>
        )}
    </div>
  );
}
