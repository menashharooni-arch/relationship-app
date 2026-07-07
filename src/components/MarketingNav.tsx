"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SwiftCardLogo from "@/components/SwiftCardLogo";

// The homepage navigation, enhanced — same links and hrefs as before, plus:
//  • gains blur + shadow once the page is scrolled (elegant sticky transition)
//  • an animated hamburger → slide-down menu on mobile (previously the section
//    links were simply hidden on small screens, unreachable from the nav).
// Purely presentational — no button/link destinations changed.

const LINKS = [
  { href: "#demo", label: "See it live" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Sign in" },
];

export default function MarketingNav() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let raf = 0;
    const check = () => { raf = 0; setStuck(window.scrollY > 6); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // Close the mobile menu on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav className={`sc-nav border-b sticky top-0 z-40 ${stuck ? "is-stuck border-warm-border" : "border-transparent bg-cream/90 backdrop-blur-sm"}`}>
      <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <Link href="/" aria-label="SwiftCard home" className="transition-transform duration-300 hover:scale-[1.03] active:scale-95">
          <SwiftCardLogo size={30} />
        </Link>

        {/* Desktop links — unchanged destinations */}
        <div className="hidden sm:flex items-center gap-8">
          <Link href="#demo" className="nav-link text-sm text-slate-500 hover:text-slate-900 transition-colors">See it live</Link>
          <Link href="/pricing" className="nav-link text-sm text-slate-500 hover:text-slate-900 transition-colors">Pricing</Link>
          <Link href="/contact" className="nav-link text-sm text-slate-500 hover:text-slate-900 transition-colors">Contact</Link>
          <Link href="/login" className="nav-link text-sm text-slate-500 hover:text-slate-900 transition-colors">Sign in</Link>
          <Link href="/login?mode=signup" className="btn-cta bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2 rounded-full text-sm">
            Get started free
          </Link>
        </div>

        {/* Mobile: Get started + animated hamburger */}
        <div className="flex sm:hidden items-center gap-3">
          <Link href="/login?mode=signup" className="btn-cta bg-brand hover:bg-brand-dark text-white font-semibold px-4 py-2 rounded-full text-[13px]">
            Get started
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="relative w-9 h-9 -mr-1 flex items-center justify-center text-slate-700"
          >
            <span className="relative block w-5 h-4">
              <span className={`absolute left-0 top-0 h-[2px] w-5 rounded-full bg-current transition-all duration-300 ${open ? "translate-y-[7px] rotate-45" : ""}`} />
              <span className={`absolute left-0 top-[7px] h-[2px] w-5 rounded-full bg-current transition-all duration-200 ${open ? "opacity-0" : "opacity-100"}`} />
              <span className={`absolute left-0 top-[14px] h-[2px] w-5 rounded-full bg-current transition-all duration-300 ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      <div
        className={`sm:hidden overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${open ? "max-h-80 opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="px-6 pb-4 pt-1 flex flex-col gap-1 bg-cream/95 backdrop-blur border-t border-warm-border">
          {LINKS.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="py-2.5 text-slate-600 hover:text-slate-900 text-[15px] font-medium transition-all"
              style={{ transitionDelay: open ? `${60 + i * 45}ms` : "0ms", transform: open ? "none" : "translateY(-6px)", opacity: open ? 1 : 0 }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
