"use client";

import { useState } from "react";
import Link from "next/link";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import ScrollProgress from "@/components/ScrollProgress";
import ScrollReveal from "@/components/ScrollReveal";
import { PLAN_LIMITS, PLAN_PRICES } from "@/lib/plan";

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID;
const ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID;
const ENTERPRISE_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID;
const ENTERPRISE_ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID;

// Display prices (USD) — sourced from PLAN_PRICES (src/lib/plan.ts), the same
// constants the checkout route validates the real Stripe price against.
const PRO_MONTHLY = PLAN_PRICES.PRO_MONTHLY_CENTS / 100;              // $/month
const PRO_ANNUAL = PLAN_PRICES.PRO_ANNUAL_CENTS / 100;                // $/year
const OFFICE_PER_USER = PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS / 100;      // $/user/month
const OFFICE_PER_USER_YEAR = PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS / 100;  // $/user/year
const OFFICE_MIN_SEATS = PLAN_LIMITS.OFFICE_MIN_SEATS;
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

const features = {
  free: [
    "1 digital business card",
    "5 new leads a month (then locked until you upgrade)",
    "All 5 card templates",
    "QR code, shareable link & NFC",
    "Unlimited Swift Links buttons",
    "Save to contacts (vCard), socials, bio, address",
    "Contacts CRM: statuses, notes, read/unread",
    "Analytics: views, best day, saves & top locations",
    "Day-1 follow-up email",
    "3 AI drafts + 3 card scans a month",
    "“Powered by SwiftCard” badge",
  ],
  pro: [
    "Everything in Free, plus:",
    "Unlimited leads & contacts",
    "Unlimited cards + custom card designer",
    "No SwiftCard branding",
    "Automated follow-up sequences — email + text (Light · Medium · Aggressive)",
    "Unlimited AI drafts & card scans",
    "Premium Swift Links: video previews, featured tiles & themes",
    "Full analytics: who viewed, when & where",
    "CSV export + Zapier, Google & HubSpot sync",
  ],
  enterprise: [
    "Everything in Pro, for every seat",
    "Shared office/team dashboard",
    "Individual card per member",
    "Admin seat controls & invites",
    "Unlimited seats (minimum 2)",
    "Bulk CSV import of contacts",
    "Priority support",
  ],
};

function Check({ color }: { color: "slate" | "blue" | "purple" }) {
  const colors = {
    slate: "text-slate-400",
    blue: "text-[#1D4ED8]",
    purple: "text-purple-600",
  };
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 shrink-0 ${colors[color]}`}>
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

type PromoState = { code: string; status: "idle" | "checking" | "valid" | "invalid"; message: string; couponId?: string; discountLabel?: string };

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [seats, setSeats] = useState<number>(OFFICE_MIN_SEATS);
  const [loading, setLoading] = useState<"pro" | "enterprise" | null>(null);
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
        const discountLabel = d.discount_percent
          ? `${d.discount_percent}% off`
          : d.discount_amount
          ? `$${(d.discount_amount / 100).toFixed(2)} off`
          : "Discount applied";
        setPromo((p) => ({
          ...p,
          status: "valid",
          message: d.description || discountLabel,
          couponId: d.stripe_coupon_id,
          discountLabel,
        }));
      } else {
        setPromo((p) => ({ ...p, status: "invalid", message: data.error || "Invalid code" }));
      }
    } catch {
      setPromo((p) => ({ ...p, status: "invalid", message: "Something went wrong" }));
    }
  }

  async function handleUpgrade(plan: "pro" | "enterprise") {
    setLoading(plan);
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
          ...(promo.status === "valid" && promo.couponId ? { couponId: promo.couponId } : {}),
        }),
      });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setLoading(null);
    }
    setLoading(null);
  }

  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <ScrollProgress />
      <ScrollReveal />

      {/* Nav */}
      <nav className="border-b border-warm-border bg-cream/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
          <Link href="/"><SwiftCardLogo size={30} /></Link>
          <div className="flex items-center gap-8">
            <Link href="/contact" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">
              Contact
            </Link>
            <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className="btn-cta bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-16 pb-10">
        <p className="text-[11px] font-bold tracking-[0.25em] text-brand uppercase mb-4">Pricing</p>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Simple, honest pricing.</h1>
        <p className="text-slate-500 text-lg max-w-md mx-auto mb-5">
          Free forever to start. Upgrade when your network grows.
        </p>
        {/* Monthly / Annual toggle */}
        <div
          className="inline-flex items-center gap-4 rounded-full px-5 py-2.5"
          style={{ background: "#EDE5D8", border: "1px solid #D4C8B8" }}
        >
          <span className={`text-sm font-medium transition-colors ${!annual ? "text-slate-900" : "text-slate-400"}`}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative w-11 h-6 rounded-full transition-colors duration-200"
            style={{ background: annual ? "#1D4ED8" : "#C8BFB3" }}
          >
            <div
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
              style={{ transform: annual ? "translateX(22px)" : "translateX(2px)" }}
            />
          </button>
          <span className={`text-sm font-medium transition-colors ${annual ? "text-slate-900" : "text-slate-400"}`}>
            Annual
            <span className="ml-1.5 text-[10px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">SAVE 10%</span>
          </span>
        </div>
      </section>

      {/* Promo code */}
      <section className="max-w-sm mx-auto w-full px-6 pb-8">
        {promo.status === "valid" ? (
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <svg viewBox="0 0 20 20" fill="#16a34a" className="w-5 h-5 shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-green-800 text-sm font-semibold">{promo.discountLabel} applied</p>
              <p className="text-green-600 text-xs">{promo.message}</p>
            </div>
            <button onClick={() => setPromo({ code: "", status: "idle", message: "" })} className="text-green-400 hover:text-green-600 text-xs">Remove</button>
          </div>
        ) : (
          <details className="group">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 transition-colors list-none flex items-center gap-1.5 justify-center">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M5.5 9A3.5 3.5 0 0 1 9 5.5H10V3H9a6 6 0 1 0 6 6v-1h-2.5v1a3.5 3.5 0 0 1-7 0V9Zm4 0a.5.5 0 0 0-1 0v5a.5.5 0 0 0 1 0V9Z" clipRule="evenodd"/>
              </svg>
              Have a promo code?
            </summary>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Enter code"
                value={promo.code}
                onChange={(e) => setPromo((p) => ({ ...p, code: e.target.value.toUpperCase(), status: "idle", message: "" }))}
                onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
                style={{ background: "#fff", borderColor: promo.status === "invalid" ? "#fca5a5" : "#D4C8B8", color: "#0f172a" }}
              />
              <button
                onClick={applyPromo}
                disabled={promo.status === "checking" || !promo.code.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
                style={{ background: "#1D4ED8", color: "#fff" }}
              >
                {promo.status === "checking" ? "…" : "Apply"}
              </button>
            </div>
            {promo.status === "invalid" && (
              <p className="text-red-500 text-xs mt-1.5 text-center">{promo.message}</p>
            )}
          </details>
        )}
      </section>

      {/* Plans */}
      <section className="max-w-6xl mx-auto w-full px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Free */}
        <div data-reveal className="card-premium bg-[#EDE5D8] border border-[#D4C8B8] rounded-3xl p-8 flex flex-col">
          <p className="text-[11px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-3">Free</p>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-4xl font-bold text-slate-900">$0</span>
            <span className="text-slate-400 text-sm mb-1.5">/ month</span>
          </div>
          <p className="text-slate-500 text-sm mb-8">Perfect to get started.</p>
          <ul className="space-y-3 mb-10 flex-1">
            {features.free.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-slate-600">
                <Check color="slate" />{f}
              </li>
            ))}
          </ul>
          <Link
            href="/login?mode=signup"
            className="w-full text-center border border-[#C8BFB3] hover:border-slate-400 text-slate-700 hover:text-slate-900 font-semibold py-3 rounded-full transition-colors text-sm bg-[#FAF7F2]"
          >
            Get Started Free →
          </Link>
        </div>

        {/* Pro — visually elevated above Free/Office: lifted, bigger shadow, ring */}
        <div data-reveal style={{ transitionDelay: "90ms" }} className="card-premium relative bg-[#1D4ED8] rounded-3xl p-8 flex flex-col shadow-2xl shadow-blue-300/60 ring-2 ring-blue-400/40 md:-mt-3 md:mb-3 z-10">
          <div className="absolute top-5 right-5 bg-white text-[#1D4ED8] text-xs font-black px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            MOST POPULAR
          </div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-blue-200 uppercase mb-3">Pro</p>
          {annual ? (
            <div className="mb-1">
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-white">${PRO_ANNUAL}</span>
                <span className="text-blue-200 text-sm mb-1.5">/ year</span>
              </div>
              <p className="text-green-300 text-xs font-semibold mt-1">~$4.50/mo · Save 10%</p>
            </div>
          ) : (
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold text-white">${PRO_MONTHLY}</span>
              <span className="text-blue-200 text-sm mb-1.5">/ month</span>
            </div>
          )}
          <p className="text-blue-200 text-sm mb-8 mt-2">Never lose a lead to the free plan&apos;s cap.</p>
          <ul className="space-y-3 mb-10 flex-1">
            {features.pro.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-blue-100">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-white">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleUpgrade("pro")}
            disabled={loading !== null}
            className="w-full bg-white hover:bg-blue-50 disabled:opacity-50 text-[#1D4ED8] font-bold py-3 rounded-full transition-colors text-sm shadow-lg"
          >
            {loading === "pro"
              ? "Loading…"
              : promo.status === "valid"
              ? `Get Pro · ${promo.discountLabel} →`
              : `Get Pro${annual ? ` · $${PRO_ANNUAL}/yr` : ` · $${PRO_MONTHLY}/mo`} →`}
          </button>
          <p className="text-center text-blue-200 text-xs mt-3">Cancel anytime — no contracts.</p>
        </div>

        {/* Office Plan */}
        <div data-reveal style={{ transitionDelay: "180ms" }} className="card-premium relative bg-[#EDE5D8] border border-[#D4C8B8] rounded-3xl p-8 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "#E0D5F0" }}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-purple-700">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-purple-700 uppercase">Office Plan</p>
          </div>
          <div className="mb-1">
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-slate-900">${annual ? (OFFICE_PER_USER_YEAR / 12).toFixed(2) : OFFICE_PER_USER}</span>
              <span className="text-slate-400 text-sm mb-1.5">/ month per user</span>
            </div>
            <p className="text-purple-700 text-xs font-semibold mt-1">
              Minimum {OFFICE_MIN_SEATS} users{annual ? " · billed annually, save 10%" : ""}
            </p>
            <p className="text-slate-900 font-bold text-[13px] mt-0.5">
              {seats} users → {annual ? `$${money(seats * OFFICE_PER_USER_YEAR)}/yr` : `$${(seats * OFFICE_PER_USER).toLocaleString()}/mo`}
            </p>
          </div>

          {/* Seat selector */}
          <div className="mt-4 mb-6">
            <label className="text-xs text-slate-500 font-medium block mb-2">Team size</label>
            <div className="flex gap-2 flex-wrap">
              {[2, 5, 10, 25, 50].map((n) => (
                <button
                  key={n}
                  onClick={() => setSeats(n)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                  style={{
                    background: seats === n ? "#7c3aed" : "#FAF7F2",
                    color: seats === n ? "#fff" : "#64748b",
                    border: seats === n ? "none" : "1px solid #D4C8B8",
                  }}
                >
                  {n} users
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">Custom:</span>
              <input
                type="number"
                min={OFFICE_MIN_SEATS}
                value={seats}
                onChange={(e) => setSeats(Math.max(OFFICE_MIN_SEATS, Math.floor(Number(e.target.value) || OFFICE_MIN_SEATS)))}
                className="w-20 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                style={{ background: "#FAF7F2", border: "1px solid #D4C8B8", color: "#0f172a" }}
              />
              <span className="text-xs text-slate-500">users · no upper limit</span>
            </div>
          </div>

          <ul className="space-y-3 mb-10 flex-1">
            {features.enterprise.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-slate-600">
                <Check color="purple" />{f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleUpgrade("enterprise")}
            disabled={loading !== null}
            className="w-full font-semibold py-3 rounded-full transition-colors text-sm text-white"
            style={{
              background: "linear-gradient(to right, #7c3aed, #4f46e5)",
              opacity: loading !== null ? 0.5 : 1,
              boxShadow: "0 4px 20px rgba(124,58,237,0.25)",
            }}
          >
            {loading === "enterprise"
              ? "Loading…"
              : `Get Office · ${annual ? `$${money(seats * OFFICE_PER_USER_YEAR)}/yr` : `$${seats * OFFICE_PER_USER}/mo`} →`}
          </button>
          <p className="text-center text-slate-400 text-xs mt-3">
            {annual ? "Billed annually per seat (10% off)." : "Billed monthly per seat."} Cancel anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-warm-border py-10 px-6 bg-cream mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <SwiftCardLogo size={24} />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
            <Link href="/login" className="hover:text-slate-900 transition-colors">Sign in</Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">Terms</Link>
          </div>
          <p className="text-slate-400 text-xs">© {new Date().getFullYear()} SwiftCard · New York, NY · All prices in USD</p>
        </div>
      </footer>
    </main>
  );
}
