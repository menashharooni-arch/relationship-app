"use client";

import { useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollProgress from "@/components/ScrollProgress";
import { PLAN_LIMITS, PLAN_PRICES } from "@/lib/plan";

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID;
const ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID;
const ENTERPRISE_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID;
const ENTERPRISE_ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID;

// Display prices (USD) — sourced from PLAN_PRICES (src/lib/plan.ts), the same
// constants the checkout route validates the real Stripe price against.
const PRO_MONTHLY = PLAN_PRICES.PRO_MONTHLY_CENTS / 100;
const PRO_ANNUAL = PLAN_PRICES.PRO_ANNUAL_CENTS / 100;
const OFFICE_PER_USER = PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS / 100;
const OFFICE_PER_USER_YEAR = PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS / 100;
const OFFICE_MIN_SEATS = PLAN_LIMITS.OFFICE_MIN_SEATS;
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

const features = {
  free: [
    "1 digital business card",
    "5 new leads a month",
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
    "Automated follow-up sequences — email + text",
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

function Dot({ tone }: { tone: "muted" | "aurora" | "on" }) {
  const bg = tone === "aurora" ? "var(--rd-aurora)" : tone === "on" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.18)";
  return (
    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: tone === "on" ? "rgba(255,255,255,0.18)" : "transparent" }}>
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke={tone === "aurora" ? "url(#g)" : bg} strokeWidth={2.4}>
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7A5CFF" /><stop offset="1" stopColor="#22D3EE" /></linearGradient></defs>
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
    <div className="rd-dark2 min-h-screen">
      <ScrollProgress />
      <div className="sc-scroll-progress" />
      <ScrollReveal />
      <SiteNav />

      <main className="overflow-clip">
        {/* Hero */}
        <section className="relative pt-32 pb-14 sm:pt-40 sm:pb-16 text-center">
          <div className="rd-grid absolute inset-0 opacity-40" />
          <div className="rd-glow rd-glow-violet rd-drift-a" style={{ width: 500, height: 500, left: "50%", transform: "translateX(-50%)", top: "-16%" }} />
          <div className="relative max-w-3xl mx-auto px-5 sm:px-6">
            <div data-reveal="fade" className="flex justify-center">
              <span className="rd-pill rd-pill-d"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--rd-aurora)" }} />Pricing</span>
            </div>
            <h1 className="rd-display text-white text-[clamp(2.4rem,5.5vw,4rem)] mt-6" data-reveal>
              Simple, honest <span className="rd-aurora-text rd-aurora-anim">pricing.</span>
            </h1>
            <p className="text-white/55 text-[1.15rem] mt-5 max-w-lg mx-auto" data-reveal>
              Free forever to start. Upgrade when your network grows — no contracts, cancel anytime.
            </p>

            {/* Monthly / Annual toggle */}
            <div className="mt-8 inline-flex items-center gap-4 rounded-full px-5 py-2.5 border border-white/12 bg-white/[0.04]" data-reveal="fade">
              <span className={`text-sm font-medium transition-colors ${!annual ? "text-white" : "text-white/40"}`}>Monthly</span>
              <button onClick={() => setAnnual(!annual)} className="relative w-11 h-6 rounded-full transition-colors duration-200" style={{ background: annual ? "#5D6BFF" : "rgba(255,255,255,0.18)" }}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200" style={{ transform: annual ? "translateX(22px)" : "translateX(2px)" }} />
              </button>
              <span className={`text-sm font-medium transition-colors ${annual ? "text-white" : "text-white/40"}`}>
                Annual <span className="ml-1 text-[10px] font-black text-emerald-300 bg-emerald-400/15 px-1.5 py-0.5 rounded-full">SAVE 10%</span>
              </span>
            </div>
          </div>
        </section>

        {/* Promo code */}
        <section className="max-w-sm mx-auto w-full px-6 pb-8">
          {promo.status === "valid" ? (
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3 border border-emerald-400/25 bg-emerald-400/10">
              <svg viewBox="0 0 20 20" fill="#34d399" className="w-5 h-5 shrink-0"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
              <div className="flex-1">
                <p className="text-emerald-200 text-sm font-semibold">{promo.discountLabel} applied</p>
                <p className="text-emerald-300/70 text-xs">{promo.message}</p>
              </div>
              <button onClick={() => setPromo({ code: "", status: "idle", message: "" })} className="text-emerald-300/60 hover:text-emerald-200 text-xs">Remove</button>
            </div>
          ) : (
            <details className="group">
              <summary className="cursor-pointer text-sm text-white/45 hover:text-white/70 transition-colors list-none flex items-center gap-1.5 justify-center">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.5 9A3.5 3.5 0 0 1 9 5.5H10V3H9a6 6 0 1 0 6 6v-1h-2.5v1a3.5 3.5 0 0 1-7 0V9Zm4 0a.5.5 0 0 0-1 0v5a.5.5 0 0 0 1 0V9Z" clipRule="evenodd" /></svg>
                Have a promo code?
              </summary>
              <div className="mt-3 flex gap-2">
                <input type="text" placeholder="Enter code" value={promo.code}
                  onChange={(e) => setPromo((p) => ({ ...p, code: e.target.value.toUpperCase(), status: "idle", message: "" }))}
                  onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white bg-white/[0.05] border focus:outline-none transition-colors"
                  style={{ borderColor: promo.status === "invalid" ? "#f87171" : "rgba(255,255,255,0.14)" }} />
                <button onClick={applyPromo} disabled={promo.status === "checking" || !promo.code.trim()} className="rd-btn rd-btn-primary text-sm px-5 py-2.5 disabled:opacity-40">
                  {promo.status === "checking" ? "…" : "Apply"}
                </button>
              </div>
              {promo.status === "invalid" && <p className="text-red-400 text-xs mt-1.5 text-center">{promo.message}</p>}
            </details>
          )}
        </section>

        {/* Plans */}
        <section className="max-w-6xl mx-auto w-full px-5 sm:px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {/* Free */}
          <div data-reveal className="rd-glass p-8 flex flex-col">
            <p className="rd-eyebrow text-white/40 mb-3">Free</p>
            <div className="flex items-end gap-1 mb-1"><span className="text-[2.6rem] font-bold text-white leading-none">$0</span><span className="text-white/40 text-sm mb-1">/ month</span></div>
            <p className="text-white/50 text-sm mb-7 mt-2">Perfect to get started.</p>
            <ul className="space-y-2.5 mb-9 flex-1">
              {features.free.map((f) => (<li key={f} className="flex items-start gap-2.5 text-[13.5px] text-white/65"><Dot tone="muted" />{f}</li>))}
            </ul>
            <Link href="/cards/new" className="rd-btn rd-btn-ghost-d w-full">Get started free →</Link>
          </div>

          {/* Pro — highlighted */}
          <div data-reveal className="relative rounded-[28px] p-8 flex flex-col overflow-hidden" style={{ transitionDelay: "90ms", background: "var(--rd-aurora)", boxShadow: "0 40px 90px -30px rgba(76,125,255,0.65)" }}>
            <div className="absolute inset-0 opacity-25" style={{ background: "radial-gradient(120% 90% at 20% -10%, rgba(255,255,255,0.6), transparent 55%)" }} />
            <div className="absolute top-5 right-5 bg-white/25 text-white text-[11px] font-bold px-3 py-1 rounded-full">MOST POPULAR</div>
            <div className="relative flex flex-col flex-1">
              <p className="rd-eyebrow text-white/80 mb-3">Pro</p>
              {annual ? (
                <div className="mb-1">
                  <div className="flex items-end gap-1"><span className="text-[2.6rem] font-bold text-white leading-none">${PRO_ANNUAL}</span><span className="text-white/75 text-sm mb-1">/ year</span></div>
                  <p className="text-white/85 text-xs font-semibold mt-1.5">~$4.50/mo · Save 10%</p>
                </div>
              ) : (
                <div className="flex items-end gap-1 mb-1"><span className="text-[2.6rem] font-bold text-white leading-none">${PRO_MONTHLY}</span><span className="text-white/75 text-sm mb-1">/ month</span></div>
              )}
              <p className="text-white/80 text-sm mb-7 mt-2">For serious networkers.</p>
              <ul className="space-y-2.5 mb-9 flex-1">
                {features.pro.map((f) => (<li key={f} className="flex items-start gap-2.5 text-[13.5px] text-white"><Dot tone="on" />{f}</li>))}
              </ul>
              <button onClick={() => handleUpgrade("pro")} disabled={loading !== null} className="w-full bg-white hover:bg-white/90 disabled:opacity-50 text-[#3E4BCC] font-bold py-3.5 rounded-full transition-colors text-sm shadow-lg">
                {loading === "pro" ? "Loading…" : promo.status === "valid" ? `Upgrade to Pro · ${promo.discountLabel} →` : `Upgrade to Pro${annual ? ` · $${PRO_ANNUAL}/yr` : ` · $${PRO_MONTHLY}/mo`} →`}
              </button>
            </div>
          </div>

          {/* Office */}
          <div data-reveal style={{ transitionDelay: "180ms" }} className="rd-glass p-8 flex flex-col">
            <p className="rd-eyebrow mb-3" style={{ color: "#8B96FF" }}>Office Plan</p>
            <div className="mb-1">
              <div className="flex items-end gap-1"><span className="text-[2.6rem] font-bold text-white leading-none">${annual ? "3.59" : OFFICE_PER_USER}</span><span className="text-white/40 text-sm mb-1">/ mo per user</span></div>
              <p className="text-cyan-300/80 text-xs font-semibold mt-1.5">Minimum {OFFICE_MIN_SEATS} users{annual ? " · billed annually, save 10%" : ""}</p>
              <p className="text-white font-bold text-[13px] mt-1">{seats} users → {annual ? `$${money(seats * OFFICE_PER_USER_YEAR)}/yr` : `$${(seats * OFFICE_PER_USER).toLocaleString()}/mo`}</p>
            </div>
            <div className="mt-4 mb-6">
              <label className="text-xs text-white/45 font-medium block mb-2">Team size</label>
              <div className="flex gap-2 flex-wrap">
                {[2, 5, 10, 25, 50].map((n) => (
                  <button key={n} onClick={() => setSeats(n)} className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                    style={{ background: seats === n ? "#5D6BFF" : "rgba(255,255,255,0.04)", color: seats === n ? "#fff" : "rgba(255,255,255,0.5)", border: seats === n ? "none" : "1px solid rgba(255,255,255,0.12)" }}>{n} users</button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-white/45">Custom:</span>
                <input type="number" min={OFFICE_MIN_SEATS} value={seats}
                  onChange={(e) => setSeats(Math.max(OFFICE_MIN_SEATS, Math.floor(Number(e.target.value) || OFFICE_MIN_SEATS)))}
                  className="w-20 rounded-lg px-2.5 py-1.5 text-xs text-white bg-white/[0.05] border border-white/12 focus:outline-none" />
                <span className="text-xs text-white/45">users</span>
              </div>
            </div>
            <ul className="space-y-2.5 mb-9 flex-1">
              {features.enterprise.map((f) => (<li key={f} className="flex items-start gap-2.5 text-[13.5px] text-white/65"><Dot tone="aurora" />{f}</li>))}
            </ul>
            <button onClick={() => handleUpgrade("enterprise")} disabled={loading !== null} className="rd-btn rd-btn-primary w-full disabled:opacity-50">
              {loading === "enterprise" ? "Loading…" : `Get Office Plan · ${annual ? `$${money(seats * OFFICE_PER_USER_YEAR)}/yr` : `$${seats * OFFICE_PER_USER}/mo`} →`}
            </button>
            <p className="text-center text-white/35 text-xs mt-3">{annual ? "Billed annually per seat (10% off)." : "Billed monthly per seat."} Min {OFFICE_MIN_SEATS} users · cancel anytime.</p>
          </div>
        </section>

        {/* Reassurance strip */}
        <section className="max-w-4xl mx-auto px-6 pb-24">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              ["No credit card to start", "Create your card and share it today, completely free."],
              ["Cancel anytime", "Month-to-month. Downgrade or cancel in one click."],
              ["Your data is yours", "Export your contacts whenever you like. No lock-in."],
            ].map(([t, d], i) => (
              <div key={t} className="rd-glass p-5" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
                <p className="text-white font-semibold text-[15px]">{t}</p>
                <p className="text-white/45 text-[13px] mt-1.5 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
