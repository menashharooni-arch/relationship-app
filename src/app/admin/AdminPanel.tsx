"use client";

import { useState, useEffect, useCallback } from "react";

type User = {
  id: string;
  username: string;
  name: string;
  email: string;
  plan: string;
  company: string | null;
  title: string | null;
  created_at: string;
  lead_count: number;
  view_count: number;
};

type PromoCode = {
  id: string;
  code: string;
  description: string | null;
  discount_percent: number | null;
  discount_amount: number | null;
  discount_type: string;
  max_uses: number | null;
  expires_at: string | null;
  plan_target: string;
  created_at: string;
};

const PLAN_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  free:       { bg: "#1f2937", text: "#6b7280", label: "Free" },
  pro:        { bg: "#1e3a5f", text: "#60a5fa", label: "Pro" },
  enterprise: { bg: "#3b0764", text: "#c084fc", label: "Enterprise" },
};

function PlanBadge({ plan, userId, onUpdated }: { plan: string; userId: string; onUpdated: () => void }) {
  const [saving, setSaving] = useState(false);
  const cfg = PLAN_STYLES[plan] ?? PLAN_STYLES.free;

  async function setPlan(next: string) {
    setSaving(true);
    await fetch("/api/admin/set-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, plan: next }),
    });
    setSaving(false);
    onUpdated();
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.text }}>
        {cfg.label}
      </span>
      <select
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        disabled={saving}
        className="text-[10px] bg-gray-800 border border-gray-700 text-gray-400 rounded-lg px-1.5 py-0.5 focus:outline-none disabled:opacity-40"
      >
        <option value="free">Free</option>
        <option value="pro">Pro</option>
        <option value="enterprise">Enterprise</option>
      </select>
    </div>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState<"users" | "promos" | "broadcast" | "referrals">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [refStats, setRefStats] = useState<{ ready: boolean; message?: string; bySource?: Record<string, number>; totalReferrals?: number; paid?: number; rewarded?: number; flagged?: number; selfReferral?: number; activeFreeMonths?: number; conversionRate?: number; flaggedList?: { code: string | null; reason: string; created_at: string }[] } | null>(null);
  const [refLoading, setRefLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ cardUrl?: string; error?: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company: "", title: "", phone: "", username: "", plan: "pro", template: "classic-pro", accentColor: "#2563eb" });

  // Promo codes state
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [promoForm, setPromoForm] = useState({ code: "", description: "", discount_percent: "20", max_uses: "", expires_at: "", plan_target: "free" });
  const [promoCreating, setPromoCreating] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Broadcast state
  const [broadcastForm, setBroadcastForm] = useState({ segment: "all", subject: "", headline: "", message: "", ctaLabel: "Open SwiftCard", ctaUrl: "" });
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent?: number; skipped?: number; error?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
    }
    setLoading(false);
  }, []);

  const loadPromos = useCallback(async () => {
    setPromosLoading(true);
    const res = await fetch("/api/admin/promo-codes");
    if (res.ok) {
      const data = await res.json();
      setPromos(data.codes ?? []);
    }
    setPromosLoading(false);
  }, []);

  const loadRefs = useCallback(async () => {
    setRefLoading(true);
    const res = await fetch("/api/admin/referrals");
    if (res.ok) setRefStats(await res.json());
    setRefLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "promos") loadPromos(); }, [tab, loadPromos]);
  useEffect(() => { if (tab === "referrals") loadRefs(); }, [tab, loadRefs]);

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setBroadcasting(true);
    setBroadcastResult(null);
    const res = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(broadcastForm),
    });
    const data = await res.json();
    if (res.ok) {
      setBroadcastResult({ sent: data.sent, skipped: data.skipped });
    } else {
      setBroadcastResult({ error: data.error });
    }
    setBroadcasting(false);
  }

  const filtered = users.filter((u) =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.company?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPro = users.filter((u) => u.plan === "pro" || u.plan === "enterprise").length;
  const totalLeads = users.reduce((s, u) => s + u.lead_count, 0);
  const totalViews = users.reduce((s, u) => s + u.view_count, 0);

  async function createPromo(e: React.FormEvent) {
    e.preventDefault();
    setPromoCreating(true);
    setPromoError(null);
    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...promoForm,
        discount_percent: promoForm.discount_percent ? Number(promoForm.discount_percent) : null,
        max_uses: promoForm.max_uses ? Number(promoForm.max_uses) : null,
        expires_at: promoForm.expires_at || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setPromoForm({ code: "", description: "", discount_percent: "20", max_uses: "", expires_at: "", plan_target: "free" });
      loadPromos();
    } else {
      setPromoError(data.error);
    }
    setPromoCreating(false);
  }

  async function deletePromo(id: string) {
    await fetch(`/api/admin/promo-codes?id=${id}`, { method: "DELETE" });
    loadPromos();
  }

  async function createCard(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateResult(null);
    const res = await fetch("/api/admin/create-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setCreateResult({ cardUrl: data.cardUrl });
      setForm({ name: "", email: "", company: "", title: "", phone: "", username: "", plan: "pro", template: "classic-pro", accentColor: "#2563eb" });
      load();
    } else {
      setCreateResult({ error: data.error });
    }
    setCreating(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top stripe */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400 z-50" />

      <div className="max-w-6xl mx-auto px-5 pt-8 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-slate-500 uppercase mb-1">SwiftCard</p>
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowCreate(true); setCreateResult(null); }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              + Create card for business
            </button>
            <a href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">← Dashboard</a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {(["users", "promos", "broadcast", "referrals"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              {t === "users" ? "Users" : t === "promos" ? "Promo Codes" : t === "broadcast" ? "Broadcast" : "Referrals"}
            </button>
          ))}
        </div>

        {tab === "referrals" && (
          <div>
            {refLoading ? (
              <div className="px-5 py-10 text-center text-gray-500 text-sm">Loading…</div>
            ) : !refStats?.ready ? (
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-2xl px-5 py-4 text-amber-200 text-sm max-w-xl">
                {refStats?.message || "Referral analytics aren't available yet — run REFERRAL_SETUP.sql in Supabase."}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Referred signups", value: refStats.totalReferrals ?? 0 },
                    { label: "Signup → paid", value: `${refStats.conversionRate ?? 0}%` },
                    { label: "Rewards granted", value: refStats.rewarded ?? 0 },
                    { label: "Active free months", value: refStats.activeFreeMonths ?? 0 },
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
                    {Object.entries(refStats.bySource ?? {}).sort((a, b) => b[1] - a[1]).map(([src, n]) => {
                      const max = Math.max(...Object.values(refStats.bySource ?? { x: 1 }), 1);
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
                    {Object.keys(refStats.bySource ?? {}).length === 0 && <p className="text-gray-500 text-xs">No signups yet.</p>}
                  </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <p className="text-white font-semibold text-sm mb-1">
                    Suspicious <span className="text-gray-500 font-normal">({refStats.flagged ?? 0} flagged · {refStats.selfReferral ?? 0} self-referrals)</span>
                  </p>
                  {(refStats.flaggedList ?? []).length === 0 ? (
                    <p className="text-gray-500 text-xs mt-2">Nothing suspicious so far.</p>
                  ) : (
                    <div className="mt-2 divide-y divide-gray-800/60">
                      {(refStats.flaggedList ?? []).map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1.5">
                          <span className="font-mono text-gray-400">{f.code || "—"}</span>
                          <span className="text-amber-400">{f.reason.replace(/_/g, " ")}</span>
                          <span className="text-gray-600">{new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "broadcast" && (
          <div className="max-w-xl">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold text-sm mb-1">Send email to users</h2>
              <p className="text-gray-500 text-xs mb-5">Only users who have opted in to marketing emails will receive this.</p>
              <form onSubmit={sendBroadcast} className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Segment</label>
                  <select value={broadcastForm.segment} onChange={(e) => setBroadcastForm((p) => ({ ...p, segment: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="all">All users</option>
                    <option value="free">Free users only</option>
                    <option value="pro">Pro / Enterprise only</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Subject *</label>
                  <input type="text" required value={broadcastForm.subject} onChange={(e) => setBroadcastForm((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="🚀 New feature just dropped"
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Headline *</label>
                  <input type="text" required value={broadcastForm.headline} onChange={(e) => setBroadcastForm((p) => ({ ...p, headline: e.target.value }))}
                    placeholder="Your digital card just got smarter"
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Body *</label>
                  <textarea required value={broadcastForm.message} onChange={(e) => setBroadcastForm((p) => ({ ...p, message: e.target.value }))}
                    rows={4} placeholder="Write a short message to your users…"
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">CTA button label</label>
                    <input type="text" value={broadcastForm.ctaLabel} onChange={(e) => setBroadcastForm((p) => ({ ...p, ctaLabel: e.target.value }))}
                      placeholder="Open SwiftCard"
                      className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">CTA URL (optional)</label>
                    <input type="url" value={broadcastForm.ctaUrl} onChange={(e) => setBroadcastForm((p) => ({ ...p, ctaUrl: e.target.value }))}
                      placeholder="https://…"
                      className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                {broadcastResult && (
                  broadcastResult.error
                    ? <p className="text-red-400 text-sm">{broadcastResult.error}</p>
                    : <p className="text-green-400 text-sm">Sent to {broadcastResult.sent} users · {broadcastResult.skipped} skipped (unsubscribed)</p>
                )}
                <button type="submit" disabled={broadcasting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  {broadcasting ? `Sending…` : "Send email"}
                </button>
              </form>
            </div>
          </div>
        )}

        {tab === "promos" && (
          <div>
            {/* Create promo form */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
              <h2 className="text-white font-semibold text-sm mb-4">Create promo code</h2>
              <form onSubmit={createPromo} className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-gray-400 block mb-1">Code *</label>
                  <input type="text" value={promoForm.code} onChange={(e) => setPromoForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="LAUNCH20" required
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-gray-400 block mb-1">Discount % *</label>
                  <input type="number" min="1" max="100" value={promoForm.discount_percent} onChange={(e) => setPromoForm((p) => ({ ...p, discount_percent: e.target.value }))}
                    placeholder="20" required
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 block mb-1">Description</label>
                  <input type="text" value={promoForm.description} onChange={(e) => setPromoForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Launch discount"
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Max uses</label>
                  <input type="number" min="1" value={promoForm.max_uses} onChange={(e) => setPromoForm((p) => ({ ...p, max_uses: e.target.value }))}
                    placeholder="Unlimited"
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Expires at</label>
                  <input type="date" value={promoForm.expires_at} onChange={(e) => setPromoForm((p) => ({ ...p, expires_at: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                {promoError && <p className="col-span-2 text-red-400 text-xs">{promoError}</p>}
                <button type="submit" disabled={promoCreating}
                  className="col-span-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-sm transition-colors">
                  {promoCreating ? "Creating…" : "Create code"}
                </button>
              </form>
            </div>

            {/* Promo codes list */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <p className="text-white font-semibold text-sm">All promo codes ({promos.length})</p>
              </div>
              {promosLoading ? (
                <div className="px-5 py-10 text-center text-gray-500 text-sm">Loading…</div>
              ) : promos.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-500 text-sm">No promo codes yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500 text-xs">
                        <th className="text-left px-5 py-3 font-medium">Code</th>
                        <th className="text-left px-4 py-3 font-medium">Discount</th>
                        <th className="text-left px-4 py-3 font-medium">Uses</th>
                        <th className="text-left px-4 py-3 font-medium">Expires</th>
                        <th className="text-left px-4 py-3 font-medium">Created</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {promos.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-5 py-3">
                            <span className="font-mono text-xs font-bold text-white bg-gray-800 px-2 py-1 rounded">{p.code}</span>
                            {p.description && <p className="text-gray-500 text-[11px] mt-0.5">{p.description}</p>}
                          </td>
                          <td className="px-4 py-3 text-green-400 font-semibold text-sm">
                            {p.discount_percent ? `${p.discount_percent}%` : p.discount_amount ? `$${p.discount_amount}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-sm">
                            {p.max_uses ? `0 / ${p.max_uses}` : "Unlimited"}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-[11px]">
                            {p.expires_at ? new Date(p.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "Never"}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-[11px]">
                            {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => deletePromo(p.id)} className="text-[11px] text-gray-600 hover:text-red-400 transition-colors">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "users" && <>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total users", value: users.length },
            { label: "Paid users", value: totalPro },
            { label: "Total leads", value: totalLeads },
            { label: "Total views", value: totalViews },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-4">
              <p className="text-2xl font-bold tabular-nums">{s.value.toLocaleString()}</p>
              <p className="text-gray-400 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Create card modal */}
        {showCreate && (
          <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center px-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-white font-bold text-lg">Create card for business</h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
              </div>

              {createResult?.cardUrl ? (
                <div className="text-center py-4">
                  <div className="w-10 h-10 bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-white font-semibold mb-1">Card created!</p>
                  <a href={createResult.cardUrl} target="_blank" rel="noopener noreferrer"
                    className="text-blue-400 text-sm underline break-all">
                    {createResult.cardUrl}
                  </a>
                  <p className="text-gray-500 text-xs mt-3">A password reset email was sent so the business owner can log in.</p>
                  <button
                    onClick={() => { setShowCreate(false); setCreateResult(null); }}
                    className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-xl text-sm transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={createCard} className="space-y-3">
                  {createResult?.error && (
                    <p className="text-red-400 text-sm bg-red-950/40 border border-red-800/40 rounded-xl px-3 py-2">{createResult.error}</p>
                  )}
                  {[
                    { key: "name", label: "Full name *", placeholder: "Jane Smith", type: "text" },
                    { key: "email", label: "Email *", placeholder: "jane@company.com", type: "email" },
                    { key: "username", label: "Username (card URL slug) *", placeholder: "jane-smith", type: "text" },
                    { key: "company", label: "Company", placeholder: "Acme Corp", type: "text" },
                    { key: "title", label: "Title", placeholder: "CEO", type: "text" },
                    { key: "phone", label: "Phone", placeholder: "+1 (555) 000-0000", type: "tel" },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-400 block mb-1">{label}</label>
                      <input
                        type={type}
                        value={form[key as keyof typeof form]}
                        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        required={["name", "email", "username"].includes(key)}
                        className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Plan</label>
                    <select
                      value={form.plan}
                      onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Card template</label>
                    <select
                      value={form.template}
                      onChange={(e) => setForm((p) => ({ ...p, template: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="classic-pro">Classic Pro</option>
                      <option value="modern-bold">Modern Bold</option>
                      <option value="photo-first">Photo First</option>
                      <option value="local-business">Local Business</option>
                      <option value="luxury-minimal">Luxury Minimal</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Accent color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={form.accentColor}
                        onChange={(e) => setForm((p) => ({ ...p, accentColor: e.target.value }))}
                        className="w-10 h-9 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer p-0.5"
                      />
                      <span className="text-gray-400 text-xs font-mono">{form.accentColor}</span>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-2"
                  >
                    {creating ? "Creating…" : "Create card"}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* User table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <p className="text-white font-semibold text-sm">All users ({filtered.length})</p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, company…"
              className="bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 w-64"
            />
          </div>

          {loading ? (
            <div className="px-5 py-10 text-center text-gray-500 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-500 text-sm">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs">
                    <th className="text-left px-5 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium">Plan</th>
                    <th className="text-left px-4 py-3 font-medium">Leads</th>
                    <th className="text-left px-4 py-3 font-medium">Views</th>
                    <th className="text-left px-4 py-3 font-medium">Joined</th>
                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-white font-medium text-xs truncate max-w-[160px]">{u.name}</p>
                        <p className="text-gray-500 text-[11px] truncate max-w-[160px]">{u.email}</p>
                        <p className="text-gray-600 text-[10px]">/{u.username}</p>
                        {u.company && <p className="text-gray-600 text-[10px] truncate max-w-[160px]">{u.company}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <PlanBadge plan={u.plan} userId={u.id} onUpdated={load} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white font-semibold tabular-nums">{u.lead_count}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-400 tabular-nums">{u.view_count}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-500 text-[11px]">
                          {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/card/${u.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            View card →
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>}
      </div>
    </div>
  );
}
