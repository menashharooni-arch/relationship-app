"use client";

// Brand-new site header: main nav row + a slim sub-header bar that points at
// the live sample dashboard. Scroll-aware (gains blur + border once you move),
// with a spring mobile menu. Colors stay on-brand: cream, slate, #1D4ED8.

import { useEffect, useState } from "react";
import Link from "next/link";
import SwiftCardLogo from "@/components/SwiftCardLogo";

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#share", label: "Ways to share" },
  { href: "#reviews", label: "Reviews" },
  { href: "/pricing", label: "Pricing" },
];

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      {/* Main row */}
      <div
        className={`transition-all duration-300 ${scrolled ? "bg-cream/90 backdrop-blur-md border-b border-warm-border shadow-[0_1px_20px_rgba(15,23,42,0.05)]" : "bg-cream"}`}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-6">
          <Link href="/" className="shrink-0" aria-label="SwiftCard home">
            <SwiftCardLogo size={28} />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="px-3.5 py-2 rounded-full text-[13.5px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-900/5 transition-colors"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            <Link href="/login" className="px-4 py-2 text-[13.5px] font-semibold text-slate-700 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className="btn-cta bg-brand hover:bg-brand-dark text-white text-[13.5px] font-semibold px-5 py-2.5 rounded-full"
            >
              Get your card — free
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-900/5 text-slate-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              {open
                ? <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h10" />}
            </svg>
          </button>
        </div>

        {/* Sub-header — the live dashboard callout */}
        <div className={`border-t transition-colors ${scrolled ? "border-warm-border/60" : "border-warm-border"} bg-[#0B1220]`}>
          <Link
            href="#demo"
            className="group max-w-6xl mx-auto px-5 sm:px-6 h-9 flex items-center justify-center gap-2 text-[12.5px] font-medium text-white/80 hover:text-white transition-colors"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            See your live dashboard — the real app, loaded with sample data
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-cream border-b border-warm-border shadow-xl">
          <div className="px-5 py-4 flex flex-col gap-1">
            {[...NAV, { href: "#demo", label: "See your live dashboard" }].map((n) => (
              <Link
                key={n.label}
                href={n.href}
                onClick={() => setOpen(false)}
                className="px-3 py-3 rounded-xl text-[15px] font-medium text-slate-700 hover:bg-slate-900/5"
              >
                {n.label}
              </Link>
            ))}
            <div className="flex gap-2.5 mt-2 pb-1">
              <Link href="/login" onClick={() => setOpen(false)} className="flex-1 text-center border border-warm-card-border rounded-full py-3 text-sm font-semibold text-slate-700">
                Sign in
              </Link>
              <Link href="/login?mode=signup" onClick={() => setOpen(false)} className="flex-1 text-center bg-brand text-white rounded-full py-3 text-sm font-semibold">
                Get your card
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
