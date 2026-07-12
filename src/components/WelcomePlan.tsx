"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EnablePushButton from "@/components/EnablePushButton";
import { PLAN_LIMITS, PLAN_PRICES } from "@/lib/plan";

// Onboarding step shown once, right after a brand-new account's first card is
// saved (routed here by GuestDraftClaim). It turns on notifications (the guest
// flow skips the wizard's notification step), then has the user choose a plan.
// Free → dashboard + guided tour. Pro/Office → Stripe checkout, which returns to
// the same dashboard + tour. Skipping keeps them Free.

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID;
const ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID;
const ENTERPRISE_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID;
const ENTERPRISE_ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID;

const PRO_MONTHLY = PLAN_PRICES.PRO_MONTHLY_CENTS / 100;
const PRO_ANNUAL = PLAN_PRICES.PRO_ANNUAL_CENTS / 100;
const OFFICE_PER_USER = PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS / 100;
const OFFICE_PER_USER_YEAR = PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS / 100;
const OFFICE_MIN_SEATS = PLAN_LIMITS.OFFICE_MIN_SEATS;

// Where checkout (and the Free button) send the user: dashboard, welcome popup,
// and an auto-started guided tour — everything a new account should get.
const LANDING = "/dashboard?welcome=1&tour=1";

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

export default function WelcomePlan({ cardSlug }: { cardSlug: string | null }) {
  const router = useRouter();
  const [annual, setAnnual] = useState(false);
  const [seats, setSeats] = useState<number>(OFFICE_MIN_SEATS);
  const [loading, setLoading] = useState<"free" | "pro" | "enterprise" | null>(null);
  const [error, setError] = useState("");

  function chooseFree() {
    setLoading("free");
    router.push(LANDING);
  }

  async function checkout(plan: "pro" | "enterprise") {
    setLoading(plan);
    setError("");
    try {
      const priceId = plan === "enterprise"
        ? (annual ? (ENTERPRISE_ANNUAL_PRICE_ID ?? ENTERPRISE_PRICE_ID) : ENTERPRISE_PRICE_ID)
        : annual ? ANNUAL_PRICE_ID : MONTHLY_PRICE_ID;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          quantity: plan === "enterprise" ? seats : 1,
          successPath: LANDING + "&upgraded=true",
        }),
      });
      if (res.status === 401) { window.location.href = "/login?next=/welcome"; return; }
      const { url, error: err } = await res.json();
      if (url) { window.location.href = url; return; }
      setError(err || "Couldn't start checkout. Please try again.");
      setLoading(null);
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setLoading(null);
    }
  }

  return (
    <main className="sc-app min-h-screen bg-gray-950 px-5 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-700/40 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-white font-bold text-2xl sm:text-3xl">Your card is live! 🎉</h1>
          {cardSlug && <p className="text-blue-400 text-sm mt-1.5 font-mono">swiftcard.me/card/{cardSlug}</p>}
          <p className="text-gray-400 text-sm mt-3 max-w-md mx-auto">Two quick things and you&apos;re all set.</p>
        </div>

        {/* Notifications */}
        <div className="max-w-md mx-auto mb-10">
          <div className="rounded-2xl border border-blue-800/40 bg-blue-950/30 px-4 py-4 mb-3 text-center">
            <p className="text-blue-200 font-semibold text-sm">🔔 Turn on notifications</p>
            <p className="text-blue-300/80 text-xs mt-1.5 leading-relaxed">Get an instant alert the moment someone shares their info through your card.</p>
          </div>
          <EnablePushButton />
        </div>

        {/* Plan selection */}
        <div className="text-center mb-6">
          <h2 className="text-white font-bold text-xl">Choose your plan</h2>
          <p className="text-gray-400 text-sm mt-1">Start free — upgrade anytime as your network grows.</p>
          <div className="mt-5 inline-flex items-center gap-3 rounded-full px-4 py-2 border border-gray-800 bg-gray-900">
            <span className={`text-xs font-medium ${!annual ? "text-white" : "text-gray-500"}`}>Monthly</span>
            <button onClick={() => setAnnual(!annual)} className="relative w-10 h-5.5 rounded-full transition-colors" style={{ width: 40, height: 22, background: annual ? "#2563EB" : "#374151" }}>
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
            <button onClick={chooseFree} disabled={loading !== null} className="w-full py-3 rounded-full text-sm font-bold bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-50">
              {loading === "free" ? "Setting up…" : "Continue free →"}
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
            <button onClick={() => checkout("pro")} disabled={loading !== null} className="w-full py-3 rounded-full text-sm font-bold bg-white text-[#2450d8] hover:bg-white/90 transition-colors disabled:opacity-50 shadow-lg">
              {loading === "pro" ? "Loading…" : "Get Pro →"}
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
            <button onClick={() => checkout("enterprise")} disabled={loading !== null} className="w-full py-3 rounded-full text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50">
              {loading === "enterprise" ? "Loading…" : `Get Office · ${seats} seats →`}
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm text-center mt-5">{error}</p>}

        <div className="text-center mt-6">
          <button onClick={chooseFree} disabled={loading !== null} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
            Skip for now — continue on the free plan →
          </button>
        </div>
      </div>
    </main>
  );
}
