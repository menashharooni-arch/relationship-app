"use client";

import { useState } from "react";
import Link from "next/link";
import KontactLogo from "@/components/KontactLogo";

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID;
const ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID;
const ENTERPRISE_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID;

const features = {
  free: [
    "1 digital business card",
    "25 leads",
    "Day 1, 15, and 30 follow-up reminders",
    "QR code and shareable link",
    "Save to contacts (vCard)",
    "Social links",
    "5 card templates",
    "Kontact branding on card",
  ],
  pro: [
    "Everything in Free",
    "Unlimited leads",
    "Up to 3 cards",
    "Analytics dashboard",
    "Lead status tags",
    "Automated emails to leads",
    "No Kontact branding",
    "CSV export",
  ],
  enterprise: [
    "Everything in Pro",
    "Unlimited team members",
    "Shared office dashboard",
    "Individual card per member",
    "Admin seat controls",
    "Priority support",
    "Custom onboarding",
    "NFC cards (coming soon)",
  ],
};

function Check({ color }: { color: "gray" | "blue" | "purple" }) {
  const colors = { gray: "text-gray-500", blue: "text-blue-400", purple: "text-purple-400" };
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 shrink-0 ${colors[color]}`}>
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [seats, setSeats] = useState(5);
  const [loading, setLoading] = useState<"pro" | "enterprise" | null>(null);

  async function handleUpgrade(plan: "pro" | "enterprise") {
    setLoading(plan);
    try {
      const priceId = plan === "enterprise"
        ? ENTERPRISE_PRICE_ID
        : annual ? ANNUAL_PRICE_ID : MONTHLY_PRICE_ID;

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          quantity: plan === "enterprise" ? seats : 1,
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
    <main className="min-h-screen bg-gray-950 flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <Link href="/"><KontactLogo size={30} /></Link>
        <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-12 pb-10">
        <p className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-4">Pricing</p>
        <h1 className="text-4xl font-bold text-white mb-4">Simple, honest pricing.</h1>
        <p className="text-gray-400 text-lg max-w-md mx-auto mb-8">
          Free forever to start. Upgrade when your network grows.
        </p>

        {/* Monthly / Annual toggle */}
        <div className="inline-flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-full px-5 py-2.5">
          <span className={`text-sm font-medium transition-colors ${!annual ? "text-white" : "text-gray-500"}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative w-11 h-6 rounded-full transition-colors duration-200"
            style={{ background: annual ? "#2563eb" : "#374151" }}
          >
            <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
              style={{ transform: annual ? "translateX(22px)" : "translateX(2px)" }} />
          </button>
          <span className={`text-sm font-medium transition-colors ${annual ? "text-white" : "text-gray-500"}`}>
            Annual
            <span className="ml-1.5 text-[10px] font-black text-green-400 bg-green-900/40 px-1.5 py-0.5 rounded-full">SAVE 20%</span>
          </span>
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-6xl mx-auto w-full px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Free */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 flex flex-col">
          <p className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">Free</p>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-4xl font-bold text-white">$0</span>
            <span className="text-gray-500 text-sm mb-1.5">/ month</span>
          </div>
          <p className="text-gray-500 text-sm mb-8">Perfect to get started.</p>
          <ul className="space-y-3 mb-10 flex-1">
            {features.free.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-gray-400">
                <Check color="gray" />{f}
              </li>
            ))}
          </ul>
          <Link href="/login" className="w-full text-center border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-semibold py-3 rounded-full transition-colors text-sm">
            Get started free →
          </Link>
        </div>

        {/* Pro */}
        <div className="relative bg-gradient-to-b from-blue-950 to-gray-900 border border-blue-700/50 rounded-3xl p-8 flex flex-col">
          <div className="absolute top-5 right-5 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">POPULAR</div>
          <p className="text-xs font-bold tracking-widest text-blue-400 uppercase mb-3">Pro</p>
          {annual ? (
            <div className="mb-1">
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-white">$77</span>
                <span className="text-gray-400 text-sm mb-1.5">/ year</span>
              </div>
              <p className="text-green-400 text-xs font-semibold mt-1">~$6.42/mo · Save $19 vs monthly</p>
            </div>
          ) : (
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold text-white">$8</span>
              <span className="text-gray-400 text-sm mb-1.5">/ month</span>
            </div>
          )}
          <p className="text-gray-400 text-sm mb-8 mt-2">For serious networkers.</p>
          <ul className="space-y-3 mb-10 flex-1">
            {features.pro.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                <Check color="blue" />{f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleUpgrade("pro")}
            disabled={loading !== null}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm shadow-lg shadow-blue-900/50"
          >
            {loading === "pro" ? "Loading…" : `Upgrade to Pro${annual ? " · $77/yr" : " · $8/mo"} →`}
          </button>
        </div>

        {/* Office Plan */}
        <div className="relative bg-gradient-to-b from-purple-950 to-gray-900 border border-purple-700/50 rounded-3xl p-8 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-purple-600/30 flex items-center justify-center">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-purple-400">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-xs font-bold tracking-widest text-purple-400 uppercase">Office Plan</p>
          </div>
          <div className="mb-1">
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-white">${(seats * 5).toLocaleString()}</span>
              <span className="text-gray-400 text-sm mb-1.5">/ month</span>
            </div>
            <p className="text-purple-300 text-xs font-semibold mt-1">$5 × {seats} users</p>
          </div>

          {/* Seat selector */}
          <div className="mt-4 mb-6">
            <label className="text-xs text-gray-500 font-medium block mb-2">Team size</label>
            <div className="flex gap-2 flex-wrap">
              {[2, 5, 10, 25, 50].map((n) => (
                <button
                  key={n}
                  onClick={() => setSeats(n)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                  style={{
                    background: seats === n ? "#7c3aed" : "#1f2937",
                    color: seats === n ? "#fff" : "#9ca3af",
                  }}
                >
                  {n} users
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-3 mb-10 flex-1">
            {features.enterprise.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                <Check color="purple" />{f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleUpgrade("enterprise")}
            disabled={loading !== null}
            className="w-full font-semibold py-3 rounded-full transition-colors text-sm"
            style={{ background: "linear-gradient(to right, #7c3aed, #4f46e5)", color: "#fff", opacity: loading !== null ? 0.5 : 1, boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
          >
            {loading === "enterprise" ? "Loading…" : `Get Office Plan · $${seats * 5}/mo →`}
          </button>
          <p className="text-center text-gray-600 text-xs mt-3">Billed monthly per seat. Cancel anytime.</p>
        </div>
      </section>

      <footer className="text-center pb-8 text-gray-600 text-xs">
        © {new Date().getFullYear()} Kontact · All prices in USD
      </footer>
    </main>
  );
}
