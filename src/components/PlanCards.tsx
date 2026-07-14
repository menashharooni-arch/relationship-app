"use client";

import { useState } from "react";
import { PLAN_LIMITS, PLAN_PRICES } from "@/lib/plan";
import { PLAN_FEATURES, PLAN_DESCRIPTIONS, money } from "@/lib/plan-content";

// The in-product plan chooser used during account creation — the card wizard's
// plan step and the /welcome step. Visually and content-wise it mirrors the
// public Pricing page (/pricing): the same highlighted Pro card (aurora fill,
// "MOST POPULAR", radial sheen + glisten sweep), the same full feature lists and
// descriptions (from plan-content), the same monthly/annual toggle with a
// SAVE 10% badge, and the same Office seat picker. It stays presentational —
// it reports the choice via onFree / onPaid and the parent runs signup/checkout.

const PRO_MONTHLY = PLAN_PRICES.PRO_MONTHLY_CENTS / 100;
const PRO_ANNUAL = PLAN_PRICES.PRO_ANNUAL_CENTS / 100;
const OFFICE_PER_USER = PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS / 100;
const OFFICE_PER_USER_YEAR = PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS / 100;
const OFFICE_MIN_SEATS = PLAN_LIMITS.OFFICE_MIN_SEATS;
const PRO_ANNUAL_PER_MO = money(PRO_ANNUAL / 12);
const OFFICE_ANNUAL_PER_MO = money(OFFICE_PER_USER_YEAR / 12);

export type PaidPlan = "pro" | "office";

function Check({ pro }: { pro?: boolean }) {
  return (
    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: pro ? "rgba(255,255,255,0.22)" : "rgba(37,99,235,0.10)" }}>
      <svg viewBox="0 0 20 20" className="w-3 h-3" fill="none" stroke={pro ? "#ffffff" : "#2563EB"} strokeWidth={2.6}>
        <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function PlanCards({
  onFree,
  onPaid,
  busy = null,
  freeLabel = "Get started free →",
}: {
  onFree: () => void;
  onPaid: (plan: PaidPlan, annual: boolean, seats: number) => void;
  busy?: "free" | PaidPlan | null;
  freeLabel?: string;
}) {
  const [annual, setAnnual] = useState(false);
  const [seats, setSeats] = useState<number>(OFFICE_MIN_SEATS);
  const disabled = busy !== null;

  return (
    <div>
      {/* Monthly / annual toggle — matches the Pricing page */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center gap-4 rounded-full px-5 py-2.5 border border-white/12 bg-white/[0.04]">
          <span className={`text-sm font-medium transition-colors ${!annual ? "text-white" : "text-white/40"}`}>Monthly</span>
          <button onClick={() => setAnnual(!annual)} aria-label="Toggle annual billing" className="relative w-11 h-6 rounded-full transition-colors duration-200" style={{ background: annual ? "#2563EB" : "#475569" }}>
            <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200" style={{ transform: annual ? "translateX(22px)" : "translateX(2px)" }} />
          </button>
          <span className={`text-sm font-medium transition-colors ${annual ? "text-white" : "text-white/40"}`}>
            Annual <span className="ml-1 text-[10px] font-black text-emerald-300 bg-emerald-400/15 px-1.5 py-0.5 rounded-full">SAVE 10%</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        {/* Free */}
        <div className="rounded-[28px] p-7 flex flex-col bg-white border border-slate-200 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.5)]">
          <p className="text-[1.35rem] font-extrabold tracking-tight text-slate-900 mb-3">Free</p>
          <div className="flex items-end gap-1 mb-1"><span className="text-[2.4rem] font-bold text-slate-900 leading-none">$0</span><span className="text-slate-400 text-sm mb-1">/ month</span></div>
          <p className="text-slate-500 text-sm mb-6 mt-2">{PLAN_DESCRIPTIONS.free}</p>
          <ul className="space-y-2.5 mb-7 flex-1">
            {PLAN_FEATURES.free.map((f) => (<li key={f} className="flex items-start gap-2.5 text-[13px] text-slate-600"><Check />{f}</li>))}
          </ul>
          <button onClick={onFree} disabled={disabled} className="w-full text-center font-bold py-3.5 rounded-full text-sm bg-slate-900 hover:bg-slate-800 text-white transition-colors disabled:opacity-50">
            {busy === "free" ? "Setting up…" : freeLabel}
          </button>
        </div>

        {/* Pro — highlighted, glistening */}
        <div className="relative rounded-[28px] p-7 flex flex-col overflow-hidden" style={{ background: "var(--rd-aurora)", boxShadow: "0 40px 90px -30px rgba(37,99,235,0.6)" }}>
          <div className="absolute inset-0 opacity-25" style={{ background: "radial-gradient(120% 90% at 20% -10%, rgba(255,255,255,0.6), transparent 55%)" }} />
          <div className="absolute top-6 right-6 z-[4] bg-white/25 text-white text-[11px] font-bold px-3 py-1 rounded-full">MOST POPULAR</div>
          <div className="relative z-[2] flex flex-col flex-1">
            <p className="text-[1.35rem] font-extrabold tracking-tight text-white mb-3">Pro</p>
            {annual ? (
              <div className="mb-1">
                <div className="flex items-end gap-1"><span className="text-[2.4rem] font-bold text-white leading-none">${PRO_ANNUAL}</span><span className="text-white/75 text-sm mb-1">/ year</span></div>
                <p className="text-white/85 text-xs font-semibold mt-1.5">~${PRO_ANNUAL_PER_MO}/mo · Save 10%</p>
              </div>
            ) : (
              <div className="flex items-end gap-1 mb-1"><span className="text-[2.4rem] font-bold text-white leading-none">${PRO_MONTHLY}</span><span className="text-white/75 text-sm mb-1">/ month</span></div>
            )}
            <p className="text-white/80 text-sm mb-6 mt-2">{PLAN_DESCRIPTIONS.pro}</p>
            <ul className="space-y-2.5 mb-7 flex-1">
              {PLAN_FEATURES.pro.map((f) => (<li key={f} className="flex items-start gap-2.5 text-[13px] text-white"><Check pro />{f}</li>))}
            </ul>
            <button onClick={() => onPaid("pro", annual, 1)} disabled={disabled} className="w-full bg-white hover:bg-white/90 disabled:opacity-50 text-[#2450d8] font-bold py-3.5 rounded-full transition-colors text-sm shadow-lg">
              {busy === "pro" ? "Loading…" : "Start 14-day free trial →"}
            </button>
            <p className="text-white/70 text-[11px] text-center mt-2 leading-relaxed">
              First-time subscribers get 14 days free. Card required — billing starts automatically after the trial unless you cancel.
            </p>
          </div>
          <span className="rd-glisten-sweep" aria-hidden="true" />
        </div>

        {/* Office */}
        <div className="rounded-[28px] p-7 flex flex-col bg-white border border-slate-200 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.5)]">
          <p className="text-[1.35rem] font-extrabold tracking-tight text-slate-900 mb-3">Office</p>
          <div className="mb-1">
            <div className="flex items-end gap-1"><span className="text-[2.4rem] font-bold text-slate-900 leading-none">${annual ? OFFICE_ANNUAL_PER_MO : OFFICE_PER_USER}</span><span className="text-slate-400 text-sm mb-1">/ mo per user</span></div>
            <p className="text-blue-600 text-xs font-semibold mt-1.5">Minimum {OFFICE_MIN_SEATS} users{annual ? " · billed annually, save 10%" : ""}</p>
            <p className="text-slate-800 font-bold text-[13px] mt-1">{seats} users → {annual ? `$${money(seats * OFFICE_PER_USER_YEAR)}/yr` : `$${(seats * OFFICE_PER_USER).toLocaleString()}/mo`}</p>
          </div>
          <div className="mt-4 mb-5">
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
          <ul className="space-y-2.5 mb-7 flex-1">
            {PLAN_FEATURES.office.map((f) => (<li key={f} className="flex items-start gap-2.5 text-[13px] text-slate-600"><Check />{f}</li>))}
          </ul>
          <button onClick={() => onPaid("office", annual, seats)} disabled={disabled} className="w-full font-bold py-3.5 rounded-full text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors">
            {busy === "office" ? "Loading…" : `Get Office Plan · ${annual ? `$${money(seats * OFFICE_PER_USER_YEAR)}/yr` : `$${seats * OFFICE_PER_USER}/mo`} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
