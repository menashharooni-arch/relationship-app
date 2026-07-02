"use client";

// Admin Overview — the owner's morning screen: who's on what plan, what's the
// business doing (signups, revenue, engagement), and where new users came from.

import { useEffect, useState } from "react";
import Link from "next/link";

type Analytics = {
  accounts: { total: number; today: number; d7: number; d30: number; series: { date: string; count: number }[]; recent: { name: string | null; email: string | null; username: string | null; plan: string | null; created_at: string }[] };
  plans: { free: number; pro: number; office: number; paid: number; conversion: number; estMrr: number };
  acquisition: { source: string; signups: number; d30: number; paid: number; paidRate: number }[];
  cards: { total: number; perAccount: number };
  leads: { total: number; today: number; d7: number };
  views: { total: number; d7: number };
  engagement: { activatedCards: number; activationRate: number };
};

const PLAN_COLORS: Record<string, string> = { free: "#6b7280", pro: "#60a5fa", enterprise: "#c084fc" };

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-4">
      <p className="text-2xl font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
      {sub && <p className="text-gray-600 text-[10px] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function OverviewClient() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then(setData)
      .catch((e) => setError(String(e.message || e)));
  }, []);

  if (error) return <p className="text-red-400 text-sm py-10">{error}</p>;
  if (!data) return <p className="text-gray-500 text-sm py-10">Loading…</p>;

  const { plans } = data;
  const planTotal = Math.max(plans.free + plans.pro + plans.office, 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-gray-500 text-sm mt-1">The state of SwiftCard right now.</p>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total users" value={data.accounts.total} sub={`+${data.accounts.today} today · +${data.accounts.d7} this week`} />
        <Stat label="Paying users" value={plans.paid} sub={`${plans.conversion}% of signups convert`} />
        <Stat label="Est. MRR" value={`$${plans.estMrr.toLocaleString()}`} sub="list prices, before discounts" />
        <Stat label="Cards created" value={data.cards.total} sub={`${data.cards.perAccount} per account`} />
      </div>

      {/* Plan mix — free vs pro vs office at a glance */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white font-semibold text-sm">Plan mix</p>
          <Link href="/admin/users" className="text-xs text-blue-400 hover:text-blue-300">Manage users →</Link>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-gray-800 mb-3">
          <div style={{ width: `${(plans.free / planTotal) * 100}%`, background: PLAN_COLORS.free }} />
          <div style={{ width: `${(plans.pro / planTotal) * 100}%`, background: PLAN_COLORS.pro }} />
          <div style={{ width: `${(plans.office / planTotal) * 100}%`, background: PLAN_COLORS.enterprise }} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <span className="text-gray-400"><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: PLAN_COLORS.free }} />Free · <b className="text-white">{plans.free}</b></span>
          <span className="text-gray-400"><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: PLAN_COLORS.pro }} />Pro · <b className="text-white">{plans.pro}</b></span>
          <span className="text-gray-400"><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: PLAN_COLORS.enterprise }} />Office · <b className="text-white">{plans.office}</b></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Acquisition — where signups come from (marketing-spend view) */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-semibold text-sm">Where signups come from</p>
            <Link href="/admin/analytics" className="text-xs text-blue-400 hover:text-blue-300">Full analytics →</Link>
          </div>
          {data.acquisition.length === 0 ? (
            <p className="text-gray-500 text-xs">No signups yet.</p>
          ) : (
            <div className="space-y-2">
              {data.acquisition.slice(0, 7).map((a) => {
                const max = Math.max(...data.acquisition.map((x) => x.signups), 1);
                return (
                  <div key={a.source} className="flex items-center gap-3 text-xs">
                    <span className="text-gray-300 w-28 shrink-0 truncate">{a.source.replace(/_/g, " ")}</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(a.signups / max) * 100}%` }} />
                    </div>
                    <span className="text-gray-400 w-8 text-right tabular-nums">{a.signups}</span>
                    <span className="text-emerald-400 w-14 text-right tabular-nums" title="paid conversion">{a.paidRate}% paid</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent signups with source */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-3">Recent signups</p>
          {data.accounts.recent.length === 0 ? (
            <p className="text-gray-500 text-xs">No signups yet.</p>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {data.accounts.recent.slice(0, 7).map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-xs gap-2">
                  <div className="min-w-0">
                    <p className="text-white truncate">{r.name || r.email || r.username}</p>
                    <p className="text-gray-600 text-[10px] truncate">{r.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#1f2937", color: PLAN_COLORS[r.plan ?? "free"] ?? "#6b7280" }}>
                      {r.plan === "enterprise" ? "office" : r.plan || "free"}
                    </span>
                    <span className="text-gray-600 text-[10px]">{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Engagement snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Contacts captured" value={data.leads.total} sub={`+${data.leads.today} today · +${data.leads.d7} this week`} />
        <Stat label="Card + link views" value={data.views.total} sub={`+${data.views.d7} this week`} />
        <Stat label="Activated cards" value={data.engagement.activatedCards} sub={`${data.engagement.activationRate}% captured ≥1 contact`} />
        <Stat label="Signups (30d)" value={data.accounts.d30} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/admin/users", title: "Users", sub: "Directory, plans, drill into any account" },
          { href: "/admin/marketing", title: "Marketing", sub: "Broadcast emails + promo codes" },
          { href: "/admin/referrals", title: "Referrals", sub: "Referral program performance + fraud" },
          { href: "/admin/plans", title: "Sandbox", sub: "Test Free / Pro / Office yourself" },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl px-4 py-4 transition-colors group">
            <p className="text-white font-semibold text-sm group-hover:text-blue-300 transition-colors">{c.title} →</p>
            <p className="text-gray-500 text-[11px] mt-1 leading-snug">{c.sub}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
