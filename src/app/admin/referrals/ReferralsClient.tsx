"use client";

// Referral program performance: signups by source, conversion to paid,
// rewards granted, active free months, and fraud flags. Custom referral codes
// are assigned per-user from the user detail page.

import { useEffect, useState } from "react";
import Link from "next/link";

type RefStats = {
  ready: boolean; message?: string;
  bySource?: Record<string, number>;
  totalReferrals?: number; paid?: number; rewarded?: number; flagged?: number;
  selfReferral?: number; activeFreeMonths?: number; conversionRate?: number;
  flaggedList?: { code: string | null; reason: string; created_at: string }[];
};

export default function ReferralsClient() {
  const [stats, setStats] = useState<RefStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/referrals").then((r) => r.json()).then(setStats).catch(() => setStats({ ready: false, message: "Failed to load" }));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referrals</h1>
        <p className="text-gray-500 text-sm mt-1">
          Referral program performance. To give someone a custom code or a free month, open them in{" "}
          <Link href="/admin/users" className="text-blue-400 hover:text-blue-300">Users</Link>.
        </p>
      </div>

      {!stats ? (
        <p className="text-gray-500 text-sm py-6">Loading…</p>
      ) : !stats.ready ? (
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-2xl px-5 py-4 text-amber-200 text-sm max-w-xl">
          {stats.message || "Referral analytics aren't available yet — run REFERRAL_SETUP.sql in Supabase."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Referred signups", value: stats.totalReferrals ?? 0 },
              { label: "Signup → paid", value: `${stats.conversionRate ?? 0}%` },
              { label: "Rewards granted", value: stats.rewarded ?? 0 },
              { label: "Active free months", value: stats.activeFreeMonths ?? 0 },
            ].map((s) => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-4">
                <p className="text-2xl font-bold tabular-nums">{typeof s.value === "number" ? s.value.toLocaleString() : s.value}</p>
                <p className="text-gray-400 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-white font-semibold text-sm mb-3">Signups by source</p>
            <div className="space-y-2">
              {Object.entries(stats.bySource ?? {}).sort((a, b) => b[1] - a[1]).map(([src, n]) => {
                const max = Math.max(...Object.values(stats.bySource ?? { x: 1 }), 1);
                return (
                  <div key={src} className="flex items-center gap-3">
                    <span className="text-gray-300 text-xs w-32 shrink-0">{src.replace(/_/g, " ")}</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(n / max) * 100}%` }} />
                    </div>
                    <span className="text-gray-400 text-xs w-10 text-right tabular-nums">{n}</span>
                  </div>
                );
              })}
              {Object.keys(stats.bySource ?? {}).length === 0 && <p className="text-gray-500 text-xs">No signups yet.</p>}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-white font-semibold text-sm mb-1">
              Suspicious <span className="text-gray-500 font-normal">({stats.flagged ?? 0} flagged · {stats.selfReferral ?? 0} self-referrals)</span>
            </p>
            {(stats.flaggedList ?? []).length === 0 ? (
              <p className="text-gray-500 text-xs mt-2">Nothing suspicious so far.</p>
            ) : (
              <div className="mt-2 divide-y divide-gray-800/60">
                {(stats.flaggedList ?? []).map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5">
                    <span className="font-mono text-gray-400">{f.code || "—"}</span>
                    <span className="text-amber-400">{f.reason.replace(/_/g, " ")}</span>
                    <span className="text-gray-600">{new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
