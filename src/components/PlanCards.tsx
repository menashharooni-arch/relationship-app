"use client";

import { useState } from "react";
import { PLAN_LIMITS, PLAN_PRICES } from "@/lib/plan";

// Dark plan chooser (Free / Pro / Office) with a monthly/annual toggle and an
// Office seat picker. Purely presentational: it reports the choice via onFree /
// onPaid and lets the parent decide what happens (store intent + sign up, or run
// Stripe checkout). Reused by the in-wizard plan step and the /welcome step.

const PRO_MONTHLY = PLAN_PRICES.PRO_MONTHLY_CENTS / 100;
const PRO_ANNUAL = PLAN_PRICES.PRO_ANNUAL_CENTS / 100;
const OFFICE_PER_USER = PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS / 100;
const OFFICE_PER_USER_YEAR = PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS / 100;
const OFFICE_MIN_SEATS = PLAN_LIMITS.OFFICE_MIN_SEATS;

const FREE_FEATURES = ["1 card", "5 leads / month", "All 5 templates", "QR, link & NFC", "Analytics & contacts CRM"];
const PRO_FEATURES = ["Unlimited leads & cards", "No SwiftCard branding", "Email + text follow-ups", "Custom card designer", "Full analytics + integrations"];
const OFFICE_FEATURES = ["Everything in Pro, per seat", "Shared team dashboard", "Admin controls & invites", "Min. 2 seats"];

function Check({ light }: { light?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke={light ? "#fff" : "#60a5fa"} strokeWidth={2.6}>
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type PaidPlan = "pro" | "office";

export default function PlanCards({
  onFree,
  onPaid,
  busy = null,
  freeLabel = "Continue free →",
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
      {/* Monthly / annual toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center gap-3 rounded-full px-4 py-2 border border-gray-800 bg-gray-900">
          <span className={`text-xs font-medium ${!annual ? "text-white" : "text-gray-500"}`}>Monthly</span>
          <button onClick={() => setAnnual(!annual)} aria-label="Toggle annual billing" className="relative rounded-full transition-colors" style={{ width: 40, height: 22, background: annual ? "#2563EB" : "#374151" }}>
            <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform: annual ? "translateX(20px)" : "translateX(2px)" }} />
          </button>
          <span className={`text-xs font-medium ${annual ? "text-white" : "text-gray-500"}`}>Annual <span className="ml-0.5 text-[9px] font-black text-emerald-400">−10%</span></span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 items-stretch">
        {/* Free */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 flex flex-col">
          <p className="text-white font-bold text-lg">Free</p>
          <div className="flex items-end gap-1 mt-2 mb-4"><span className="text-3xl font-bold text-white leading-none">$0</span><span className="text-gray-500 text-xs mb-1">/ mo</span></div>
          <ul className="space-y-2 mb-6 flex-1">
            {FREE_FEATURES.map((f) => (<li key={f} className="flex items-start gap-2 text-[13px] text-gray-300"><Check />{f}</li>))}
          </ul>
          <button onClick={onFree} disabled={disabled} className="w-full py-3 rounded-full text-sm font-bold bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-50">
            {busy === "free" ? "Setting up…" : freeLabel}
          </button>
        </div>

        {/* Pro */}
        <div className="relative rounded-2xl p-6 flex flex-col overflow-hidden" style={{ background: "var(--rd-aurora)", boxShadow: "0 30px 70px -30px rgba(37,99,235,0.6)" }}>
          <div className="absolute top-4 right-4 bg-white/25 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">POPULAR</div>
          <p className="text-white font-bold text-lg">Pro</p>
          <div className="flex items-end gap-1 mt-2 mb-4">
            <span className="text-3xl font-bold text-white leading-none">${annual ? PRO_ANNUAL : PRO_MONTHLY}</span>
            <span className="text-white/70 text-xs mb-1">/ {annual ? "yr" : "mo"}</span>
          </div>
          <ul className="space-y-2 mb-6 flex-1">
            {PRO_FEATURES.map((f) => (<li key={f} className="flex items-start gap-2 text-[13px] text-white"><Check light />{f}</li>))}
          </ul>
          <button onClick={() => onPaid("pro", annual, 1)} disabled={disabled} className="w-full py-3 rounded-full text-sm font-bold bg-white text-[#2450d8] hover:bg-white/90 transition-colors disabled:opacity-50 shadow-lg">
            {busy === "pro" ? "Loading…" : "Choose Pro →"}
          </button>
        </div>

        {/* Office */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 flex flex-col">
          <p className="text-white font-bold text-lg">Office</p>
          <div className="flex items-end gap-1 mt-2 mb-1"><span className="text-3xl font-bold text-white leading-none">${annual ? OFFICE_PER_USER_YEAR : OFFICE_PER_USER}</span><span className="text-gray-500 text-xs mb-1">/ mo·user</span></div>
          <div className="flex flex-wrap gap-1.5 mb-4 mt-2">
            {[2, 5, 10, 25].map((n) => (
              <button key={n} onClick={() => setSeats(n)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors" style={{ background: seats === n ? "#2563EB" : "#1f2937", color: seats === n ? "#fff" : "#9ca3af" }}>{n}</button>
            ))}
          </div>
          <ul className="space-y-2 mb-6 flex-1">
            {OFFICE_FEATURES.map((f) => (<li key={f} className="flex items-start gap-2 text-[13px] text-gray-300"><Check />{f}</li>))}
          </ul>
          <button onClick={() => onPaid("office", annual, seats)} disabled={disabled} className="w-full py-3 rounded-full text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50">
            {busy === "office" ? "Loading…" : `Choose Office · ${seats} seats →`}
          </button>
        </div>
      </div>
    </div>
  );
}
