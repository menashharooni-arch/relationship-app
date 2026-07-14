"use client";

import { useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollProgress from "@/components/ScrollProgress";
import { PLAN_LIMITS, PLAN_PRICES } from "@/lib/plan";
import { PLAN_FEATURES } from "@/lib/plan-content";
import { formatCents, formatUsd, seatSubtotalCents, perMonthCents } from "@/lib/currency";


// Display prices (USD) — sourced from PLAN_PRICES (src/lib/plan.ts), the same
// constants the checkout route validates the real Stripe price against.
const PRO_MONTHLY = PLAN_PRICES.PRO_MONTHLY_CENTS / 100;
const PRO_ANNUAL = PLAN_PRICES.PRO_ANNUAL_CENTS / 100;
const OFFICE_MIN_SEATS = PLAN_LIMITS.OFFICE_MIN_SEATS;

// Feature lists + descriptions come from the shared plan-content module so the
// Pricing page and the in-product plan chooser never drift apart.
const features = { free: PLAN_FEATURES.free, pro: PLAN_FEATURES.pro, enterprise: PLAN_FEATURES.office };

function Check({ pro }: { pro?: boolean }) {
  return (
    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: pro ? "rgba(255,255,255,0.22)" : "rgba(37,99,235,0.10)" }}>
      <svg viewBox="0 0 20 20" className="w-3 h-3" fill="none" stroke={pro ? "#ffffff" : "#2563EB"} strokeWidth={2.6}>
        <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

type PromoState = { code: string; status: "idle" | "checking" | "valid" | "invalid"; message: string; couponId?: string; discountLabel?: string };

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [seats, setSeats] = useState<number>(OFFICE_MIN_SEATS);
  const [loading, setLoading] = useState<"pro" | "enterprise" | null>(null);
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null);
  const [promo, setPromo] = useState<PromoState>({ code: "", status: "idle", message: "" });

  async function applyPromo() {
    if (!promo.code.trim()) return;
    setPromo((p) => ({ ...p, status: "checking", message: "" }));
    try {
      const res = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promo.code.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        const d = data.promo;
        const discountLabel = d.discount_percent ? `${d.discount_percent}% off` : d.discount_amount ? `$${(d.discount_amount / 100).toFixed(2)} off` : "Discount applied";
        setPromo((p) => ({ ...p, status: "valid", message: d.description || discountLabel, couponId: d.stripe_coupon_id, discountLabel }));
      } else {
        setPromo((p) => ({ ...p, status: "invalid", message: data.error || "Invalid code" }));
      }
    } catch {
      setPromo((p) => ({ ...p, status: "invalid", message: "Something went wrong" }));
    }
  }

  function handleUpgrade(plan: "pro" | "enterprise") {
    setLoading(plan);
    setCheckoutErr(null);
    // Carry the EXACT selection (plan, interval, seats, promo) into /checkout via
    // the URL, so it survives login/signup/refresh/back-forward and a canceled or
    // failed checkout — the user never has to re-choose (spec §1). /checkout shows
    // the order summary, handles auth (bounce to signup → auto-resume), and starts
    // the Stripe session.
    const planKey = plan === "enterprise" ? "office" : "pro";
    const qs = new URLSearchParams({ plan: planKey, interval: annual ? "annual" : "monthly" });
    if (plan === "enterprise") qs.set("seats", String(seats));
    if (promo.status === "valid" && promo.couponId) qs.set("coupon", promo.couponId);
    window.location.href = `/checkout?${qs.toString()}`;
  }

  return (
    <div className="bg-white text-slate-900 min-h-screen">
      <ScrollProgress />
      <ScrollReveal />
      <SiteNav />

      <main className="overflow-clip">
        {/* Hero */}
        <section className="relative pt-32 pb-14 sm:pt-40 sm:pb-16 text-center">
          <div className="relative max-w-3xl mx-auto px-5 sm:px-6">
            <h1 className="rd-display text-slate-900 text-[clamp(2.4rem,5.5vw,4rem)]" data-reveal>
              Simple, honest <span className="rd-aurora-text rd-aurora-anim">pricing.</span>
            </h1>
            <p className="text-slate-500 text-[1.15rem] mt-5 max-w-lg mx-auto" data-reveal>
              Free forever to start. Upgrade when your network grows — no contracts, cancel anytime.
            </p>

            {/* Monthly / Annual toggle */}
            <div className="mt-8 inline-flex items-center gap-4 rounded-full px-5 py-2.5 border border-slate-200 bg-slate-50" data-reveal="fade">
              <span className={`text-sm font-medium transition-colors ${!annual ? "text-slate-900" : "text-slate-400"}`}>Monthly</span>
              <button onClick={() => setAnnual(!annual)} aria-label="Toggle annual billing" aria-pressed={annual} className="relative w-11 h-6 rounded-full transition-colors duration-200" style={{ background: annual ? "#2563EB" : "#cbd5e1" }}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200" style={{ transform: annual ? "translateX(22px)" : "translateX(2px)" }} />
              </button>
              <span className={`text-sm font-medium transition-colors ${annual ? "text-slate-900" : "text-slate-400"}`}>
                Annual <span className="ml-1 text-[10px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">SAVE 10%</span>
              </span>
            </div>
          </div>
        </section>

        {/* Plans — equal-size cards, buttons aligned at the bottom */}
        <section className="max-w-6xl mx-auto w-full px-5 sm:px-6 pb-14 grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {/* Free */}
          <div data-reveal className="rounded-[28px] p-8 flex flex-col bg-white border border-slate-200 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.3)]">
            <p className="text-[1.4rem] font-extrabold tracking-tight text-slate-900 mb-3">Free</p>
            <div className="flex items-end gap-1 mb-1"><span className="text-[2.6rem] font-bold text-slate-900 leading-none">$0</span><span className="text-slate-400 text-sm mb-1">/ month</span></div>
            <p className="text-slate-500 text-sm mb-7 mt-2">Perfect to get started.</p>
            <ul className="space-y-2.5 mb-8 flex-1">
              {features.free.map((f) => (<li key={f} className="flex items-start gap-2.5 text-[13.5px] text-slate-600"><Check />{f}</li>))}
            </ul>
            <Link href="/cards/new" className="w-full text-center font-bold py-3.5 rounded-full text-sm bg-slate-900 hover:bg-slate-800 text-white transition-colors">Get started free →</Link>
          </div>

          {/* Pro — highlighted, glistening */}
          <div data-reveal className="relative rounded-[28px] p-8 flex flex-col overflow-hidden" style={{ transitionDelay: "90ms", background: "var(--rd-aurora)", boxShadow: "0 40px 90px -30px rgba(37,99,235,0.6)" }}>
            <div className="absolute inset-0 opacity-25" style={{ background: "radial-gradient(120% 90% at 20% -10%, rgba(255,255,255,0.6), transparent 55%)" }} />
            <div className="absolute top-6 right-6 z-[4] bg-white/25 text-white text-[11px] font-bold px-3 py-1 rounded-full">MOST POPULAR</div>
            <div className="relative z-[2] flex flex-col flex-1">
              <p className="text-[1.4rem] font-extrabold tracking-tight text-white mb-3">Pro</p>
              {annual ? (
                <div className="mb-1">
                  <div className="flex items-end gap-1"><span className="text-[2.6rem] font-bold text-white leading-none">${PRO_ANNUAL}</span><span className="text-white/75 text-sm mb-1">/ year</span></div>
                  <p className="text-white/85 text-xs font-semibold mt-1.5">~$4.50/mo · Save 10%</p>
                </div>
              ) : (
                <div className="flex items-end gap-1 mb-1"><span className="text-[2.6rem] font-bold text-white leading-none">${PRO_MONTHLY}</span><span className="text-white/75 text-sm mb-1">/ month</span></div>
              )}
              <p className="text-white/80 text-sm mb-7 mt-2">For serious networkers.</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {features.pro.map((f) => (<li key={f} className="flex items-start gap-2.5 text-[13.5px] text-white"><Check pro />{f}</li>))}
              </ul>
              <button onClick={() => handleUpgrade("pro")} disabled={loading !== null} className="w-full bg-white hover:bg-white/90 disabled:opacity-50 text-[#2450d8] font-bold py-3.5 rounded-full transition-colors text-sm shadow-lg">
                {loading === "pro" ? "Loading…" : promo.status === "valid" ? `Get Pro Plan · ${promo.discountLabel} →` : "Start 14-day free trial →"}
              </button>
              <p className="text-white/70 text-[11px] text-center mt-2 leading-relaxed">
                First-time subscribers get 14 days free. Card required — billing starts automatically after the trial unless you cancel.
              </p>
              {checkoutErr && loading === null && (
                <p className="text-center text-[12px] font-semibold mt-2 rounded-lg py-2 px-3" style={{ background: "rgba(254,226,226,0.95)", color: "#b91c1c" }}>{checkoutErr}</p>
              )}
            </div>
            <span className="rd-glisten-sweep" aria-hidden="true" />
          </div>

          {/* Office */}
          <div data-reveal style={{ transitionDelay: "180ms" }} className="rounded-[28px] p-8 flex flex-col bg-white border border-slate-200 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.3)]">
            <p className="text-[1.4rem] font-extrabold tracking-tight text-slate-900 mb-3">Office</p>
            <div className="mb-1">
              <div className="flex items-end gap-1"><span className="text-[2.6rem] font-bold text-slate-900 leading-none">${annual ? formatCents(perMonthCents(PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS)) : formatCents(PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS)}</span><span className="text-slate-400 text-sm mb-1">/ mo per user</span></div>
              <p className="text-blue-600 text-xs font-semibold mt-1.5">Minimum {OFFICE_MIN_SEATS} users{annual ? " · billed annually, save 10%" : ""}</p>
              <p className="text-slate-800 font-bold text-[13px] mt-1">{seats} users → {annual
                ? `${formatUsd(seatSubtotalCents(PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS, seats))}/yr`
                : `${formatUsd(seatSubtotalCents(PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS, seats))}/mo`}</p>
            </div>
            <div className="mt-4 mb-6">
              <label className="text-xs text-slate-400 font-medium block mb-2">Team size</label>
              <div className="flex gap-2 flex-wrap">
                {[2, 5, 10, 25, 50].map((n) => (
                  <button key={n} onClick={() => setSeats(n)} className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                    style={{ background: seats === n ? "#2563EB" : "#f1f5f9", color: seats === n ? "#fff" : "#64748b", border: seats === n ? "none" : "1px solid #e2e8f0" }}>{n} users</button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-400">Custom:</span>
                <input type="number" min={OFFICE_MIN_SEATS} value={seats}
                  onChange={(e) => setSeats(Math.max(OFFICE_MIN_SEATS, Math.floor(Number(e.target.value) || OFFICE_MIN_SEATS)))}
                  className="w-20 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-200 focus:outline-none" />
                <span className="text-xs text-slate-400">users</span>
              </div>
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {features.enterprise.map((f) => (<li key={f} className="flex items-start gap-2.5 text-[13.5px] text-slate-600"><Check />{f}</li>))}
            </ul>
            <button onClick={() => handleUpgrade("enterprise")} disabled={loading !== null} className="w-full font-bold py-3.5 px-3 rounded-full text-sm leading-tight bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors break-words">
              {loading === "enterprise" ? "Loading…" : `Get Office · ${annual
                ? `${formatUsd(seatSubtotalCents(PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS, seats))}/yr`
                : `${formatUsd(seatSubtotalCents(PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS, seats))}/mo`} →`}
            </button>
          </div>
        </section>

        {/* Promo code — under the plans */}
        <section className="max-w-sm mx-auto w-full px-6 pb-24">
          {promo.status === "valid" ? (
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3 border border-emerald-200 bg-emerald-50">
              <svg viewBox="0 0 20 20" fill="#10b981" className="w-5 h-5 shrink-0"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
              <div className="flex-1">
                <p className="text-emerald-700 text-sm font-semibold">{promo.discountLabel} applied</p>
                <p className="text-emerald-600/80 text-xs">{promo.message}</p>
              </div>
              <button onClick={() => setPromo({ code: "", status: "idle", message: "" })} className="text-emerald-600/70 hover:text-emerald-700 text-xs">Remove</button>
            </div>
          ) : (
            <details className="group">
              <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-800 transition-colors list-none flex items-center gap-1.5 justify-center">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.5 9A3.5 3.5 0 0 1 9 5.5H10V3H9a6 6 0 1 0 6 6v-1h-2.5v1a3.5 3.5 0 0 1-7 0V9Zm4 0a.5.5 0 0 0-1 0v5a.5.5 0 0 0 1 0V9Z" clipRule="evenodd" /></svg>
                Have a promo code?
              </summary>
              <div className="mt-3 flex gap-2">
                <input type="text" placeholder="Enter code" value={promo.code}
                  onChange={(e) => setPromo((p) => ({ ...p, code: e.target.value.toUpperCase(), status: "idle", message: "" }))}
                  onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white border focus:outline-none transition-colors"
                  style={{ borderColor: promo.status === "invalid" ? "#f87171" : "#e2e8f0" }} />
                <button onClick={applyPromo} disabled={promo.status === "checking" || !promo.code.trim()} className="font-bold text-sm px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors">
                  {promo.status === "checking" ? "…" : "Apply"}
                </button>
              </div>
              {promo.status === "invalid" && <p className="text-red-500 text-xs mt-1.5 text-center">{promo.message}</p>}
            </details>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
