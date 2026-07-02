"use client";

// Marketing: broadcast emails to user segments (with live recipient counts and
// a mandatory-feeling "send test to me" step) + promo code management.

import { useCallback, useEffect, useState } from "react";

type Counts = { all: number; free: number; pro: number; office: number };
type PromoCode = {
  id: string; code: string; description: string | null; discount_percent: number | null;
  discount_amount: number | null; max_uses: number | null; expires_at: string | null; created_at: string;
};

export default function MarketingClient() {
  // Broadcast
  const [counts, setCounts] = useState<Counts | null>(null);
  const [optedOut, setOptedOut] = useState(0);
  const [emailReady, setEmailReady] = useState(true);
  const [form, setForm] = useState({ segment: "all", subject: "", headline: "", message: "", ctaLabel: "Open SwiftCard", ctaUrl: "" });
  const [sending, setSending] = useState<"" | "test" | "real">("");
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Promos
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [promosReady, setPromosReady] = useState(true);
  const [promoForm, setPromoForm] = useState({ code: "", description: "", discount_percent: "20", max_uses: "", expires_at: "", plan_target: "free" });
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/broadcast")
      .then((r) => r.json())
      .then((d) => {
        if (d.counts) { setCounts(d.counts); setOptedOut(d.optedOut ?? 0); setEmailReady(d.emailTablesReady !== false); }
      })
      .catch(() => {});
  }, []);

  const loadPromos = useCallback(async () => {
    const res = await fetch("/api/admin/promo-codes");
    if (res.ok) {
      const data = await res.json();
      setPromos(data.codes ?? []);
      setPromosReady(true);
    } else {
      setPromosReady(false);
    }
  }, []);
  useEffect(() => { loadPromos(); }, [loadPromos]);

  const recipientCount = counts ? counts[form.segment as keyof Counts] ?? 0 : null;

  async function send(test: boolean) {
    setSending(test ? "test" : "real");
    setResult(null);
    const res = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, ctaUrl: form.ctaUrl || undefined, test }),
    });
    const d = await res.json();
    if (res.ok) {
      setResult({ ok: test ? `Test sent to ${d.to} — check your inbox before the real send.` : `Sent to ${d.sent} users · ${d.skipped} skipped (unsubscribed or no email)` });
    } else {
      setResult({ error: d.error || "Send failed" });
    }
    setSending("");
    setConfirming(false);
  }

  async function createPromo(e: React.FormEvent) {
    e.preventDefault();
    setPromoBusy(true);
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
    setPromoBusy(false);
  }

  const inputCls = "w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Marketing</h1>
        <p className="text-gray-500 text-sm mt-1">Email your users and run promotions. Always send yourself a test first.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Broadcast composer */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold text-sm mb-1">Send email to users</h2>
          <p className="text-gray-500 text-xs mb-5">Users who unsubscribed from marketing are skipped automatically; every email includes an unsubscribe link.</p>
          {!emailReady && (
            <p className="text-amber-300 text-xs bg-amber-950/40 border border-amber-800/40 rounded-xl px-3 py-2 mb-4">
              Email preference tables aren&apos;t set up — run <span className="font-mono">supabase/email-system.sql</span> in the Supabase SQL editor so unsubscribes are honored before sending broadcasts.
            </p>
          )}
          <form onSubmit={(e) => { e.preventDefault(); setConfirming(true); }} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Segment</label>
              <select value={form.segment} onChange={(e) => setForm((p) => ({ ...p, segment: e.target.value }))} className={inputCls}>
                <option value="all">All users{counts ? ` (${counts.all})` : ""}</option>
                <option value="free">Free users{counts ? ` (${counts.free})` : ""}</option>
                <option value="pro">Pro + Office{counts ? ` (${counts.pro})` : ""}</option>
                <option value="office">Office only{counts ? ` (${counts.office})` : ""}</option>
              </select>
              {counts && (
                <p className="text-gray-600 text-[11px] mt-1">
                  ≈ {recipientCount} recipients{optedOut ? ` · ${optedOut} opted out of marketing` : ""}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Subject *</label>
              <input type="text" required value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                placeholder="🚀 New feature just dropped" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Headline *</label>
              <input type="text" required value={form.headline} onChange={(e) => setForm((p) => ({ ...p, headline: e.target.value }))}
                placeholder="Your digital card just got smarter" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Body *</label>
              <textarea required value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                rows={5} placeholder="Write a short message to your users…" className={`${inputCls} resize-none`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">CTA button label</label>
                <input type="text" value={form.ctaLabel} onChange={(e) => setForm((p) => ({ ...p, ctaLabel: e.target.value }))}
                  placeholder="Open SwiftCard" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">CTA URL (optional)</label>
                <input type="url" value={form.ctaUrl} onChange={(e) => setForm((p) => ({ ...p, ctaUrl: e.target.value }))}
                  placeholder="https://swiftcard.me/…" className={inputCls} />
              </div>
            </div>

            {result?.ok && <p className="text-emerald-400 text-sm">{result.ok}</p>}
            {result?.error && <p className="text-red-400 text-sm">{result.error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => send(true)}
                disabled={sending !== "" || !form.subject || !form.headline || !form.message}
                className="flex-1 border border-gray-600 text-gray-200 hover:border-gray-400 disabled:opacity-50 font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {sending === "test" ? "Sending test…" : "Send test to me"}
              </button>
              <button
                type="submit"
                disabled={sending !== ""}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Send to segment
              </button>
            </div>
          </form>
        </div>

        {/* Promo codes */}
        <div className="space-y-5">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold text-sm mb-4">Create promo code</h2>
            {!promosReady && (
              <p className="text-amber-300 text-xs bg-amber-950/40 border border-amber-800/40 rounded-xl px-3 py-2 mb-4">
                Promo tables aren&apos;t set up — run <span className="font-mono">supabase/email-system.sql</span> in the Supabase SQL editor.
              </p>
            )}
            <form onSubmit={createPromo} className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Code *</label>
                <input type="text" value={promoForm.code} onChange={(e) => setPromoForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="LAUNCH20" required className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Discount % *</label>
                <input type="number" min="1" max="100" value={promoForm.discount_percent} onChange={(e) => setPromoForm((p) => ({ ...p, discount_percent: e.target.value }))}
                  required className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-400 block mb-1">Description</label>
                <input type="text" value={promoForm.description} onChange={(e) => setPromoForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Launch discount" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Max uses</label>
                <input type="number" min="1" value={promoForm.max_uses} onChange={(e) => setPromoForm((p) => ({ ...p, max_uses: e.target.value }))}
                  placeholder="Unlimited" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Expires</label>
                <input type="date" value={promoForm.expires_at} onChange={(e) => setPromoForm((p) => ({ ...p, expires_at: e.target.value }))} className={inputCls} />
              </div>
              {promoError && <p className="col-span-2 text-red-400 text-xs">{promoError}</p>}
              <button type="submit" disabled={promoBusy}
                className="col-span-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-sm transition-colors">
                {promoBusy ? "Creating…" : "Create code"}
              </button>
            </form>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-800">
              <p className="text-white font-semibold text-sm">Promo codes ({promos.length})</p>
            </div>
            {promos.length === 0 ? (
              <p className="px-5 py-8 text-center text-gray-500 text-sm">No promo codes yet</p>
            ) : (
              <div className="divide-y divide-gray-800/60">
                {promos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-2.5 text-xs gap-3">
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-white bg-gray-800 px-2 py-0.5 rounded">{p.code}</span>
                      {p.description && <span className="text-gray-500 ml-2">{p.description}</span>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-green-400 font-semibold">{p.discount_percent ? `${p.discount_percent}%` : p.discount_amount ? `$${p.discount_amount}` : "—"}</span>
                      <span className="text-gray-600">{p.expires_at ? `until ${new Date(p.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "no expiry"}</span>
                      <button onClick={async () => { await fetch(`/api/admin/promo-codes?id=${p.id}`, { method: "DELETE" }); loadPromos(); }}
                        className="text-gray-600 hover:text-red-400 transition-colors">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm modal for the real send */}
      {confirming && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center px-4" onClick={(e) => e.target === e.currentTarget && setConfirming(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <p className="text-white font-bold mb-2">Send to {recipientCount ?? "all"} users?</p>
            <p className="text-gray-400 text-sm mb-1">Subject: <span className="text-white">{form.subject}</span></p>
            <p className="text-gray-500 text-xs mb-5">This goes out immediately and can&apos;t be recalled. Did you send yourself a test?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="flex-1 border border-gray-700 text-gray-400 hover:border-gray-500 font-semibold py-2.5 rounded-xl text-sm transition-colors">
                Cancel
              </button>
              <button onClick={() => send(false)} disabled={sending !== ""}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                {sending === "real" ? "Sending…" : "Yes, send it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
