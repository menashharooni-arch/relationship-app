"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";

// ── SwiftCard 2.0 marketing navigation ──────────────────────────────────────
// Floating graphite-glass bar: transparent over the dark hero, condenses into a
// blurred bar on scroll. Product / Solutions / Resources mega-dropdowns on
// desktop; full-screen sheet on mobile. Every link points at a real route.

type Item = { label: string; href: string; desc: string };

const PRODUCTS: Item[] = [
  { label: "Digital Cards", href: "/products/digital-cards", desc: "Your tap-to-share business card" },
  { label: "SwiftLinks", href: "/products/swiftlinks", desc: "One link for everything you are" },
  { label: "Email Signatures", href: "/products/email-signatures", desc: "A live card in every email" },
  { label: "Lead Capture", href: "/products/lead-capture", desc: "Turn every scan into a contact" },
];
const SOLUTIONS: Item[] = [
  { label: "Dashboard & Analytics", href: "/products/analytics", desc: "See who's viewing and saving" },
  { label: "Teams & Offices", href: "/products/teams", desc: "One brand across everyone" },
  { label: "Apple Wallet", href: "/products/wallet", desc: "Your card, always in your pocket" },
  { label: "Apple Watch", href: "/products/watch", desc: "Share from your wrist" },
  { label: "Integrations", href: "/products/integrations", desc: "Zapier, Google, HubSpot & CSV" },
];
const RESOURCES: Item[] = [
  { label: "See it live", href: "/preview", desc: "Interact with a real SwiftCard" },
  { label: "Templates", href: "/templates", desc: "Beautiful, ready-to-use designs" },
  { label: "Contact", href: "/contact", desc: "Talk to the team" },
  { label: "Privacy", href: "/privacy", desc: "How we protect your data" },
];

function Caret() {
  return (
    <svg viewBox="0 0 12 12" className="w-3 h-3 opacity-60 transition-transform duration-200 group-hover:rotate-180" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dropdown({ label, items }: { label: string; items: Item[] }) {
  return (
    <div className="group relative">
      <button className="inline-flex items-center gap-1.5 px-3 py-2 text-[14px] font-medium text-white/70 hover:text-white transition-colors">
        {label}
        <Caret />
      </button>
      {/* hover bridge + panel */}
      <div className="invisible opacity-0 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 absolute left-1/2 -translate-x-1/2 top-full pt-3 w-[340px]">
        <div className="rounded-2xl border border-white/10 bg-[#0E1017]/95 backdrop-blur-xl p-2 shadow-[0_40px_80px_-32px_rgba(0,0,0,0.8)]">
          {items.map((it) => (
            <Link key={it.label} href={it.href} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.06] transition-colors">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--rd-aurora)" }} />
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-white">{it.label}</span>
                <span className="block text-[12.5px] text-white/50 leading-snug">{it.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SiteNav() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <header
        className="fixed top-0 inset-x-0 z-[70] transition-all duration-300"
        style={{
          background: stuck ? "rgba(10,11,16,0.72)" : "transparent",
          backdropFilter: stuck ? "saturate(1.4) blur(14px)" : "none",
          WebkitBackdropFilter: stuck ? "saturate(1.4) blur(14px)" : "none",
          borderBottom: `1px solid ${stuck ? "var(--rd-line-dark)" : "transparent"}`,
        }}
      >
        <nav className="max-w-7xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <SwiftCardIcon size={30} />
            <span className="text-white font-bold text-[17px] tracking-tight">SwiftCard</span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            <Dropdown label="Products" items={PRODUCTS} />
            <Dropdown label="Solutions" items={SOLUTIONS} />
            <Dropdown label="Resources" items={RESOURCES} />
            <Link href="/pricing" className="px-3 py-2 text-[14px] font-medium text-white/70 hover:text-white transition-colors">Pricing</Link>
          </div>

          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            <Link href="/login" className="px-3.5 py-2 text-[14px] font-medium text-white/75 hover:text-white transition-colors">Log in</Link>
            <Link href="/cards/new" className="rd-btn rd-btn-primary text-[14px] px-4 py-2">Get started free</Link>
          </div>

          {/* Mobile trigger */}
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-white hover:bg-white/10 transition-colors">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" /></svg>
          </button>
        </nav>
      </header>

      {/* Mobile sheet */}
      {open && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <div className="absolute inset-0 bg-[#06070A]/80 backdrop-blur-xl" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 top-0 rounded-b-3xl border-b border-white/10 bg-[#0A0B10] p-5 pt-5 shadow-2xl animate-[sc-notif-in_.2s_ease]">
            <div className="flex items-center justify-between mb-5">
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
                <SwiftCardIcon size={28} /><span className="text-white font-bold text-[16px]">SwiftCard</span>
              </Link>
              <button onClick={() => setOpen(false)} aria-label="Close" className="w-10 h-10 flex items-center justify-center rounded-xl text-white hover:bg-white/10">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="space-y-5 max-h-[70vh] overflow-y-auto rd-scrollbar-none">
              {[["Products", PRODUCTS], ["Solutions", SOLUTIONS], ["Resources", RESOURCES]].map(([title, items]) => (
                <div key={title as string}>
                  <p className="rd-eyebrow text-white/40 mb-2">{title as string}</p>
                  <div className="grid grid-cols-1 gap-0.5">
                    {(items as Item[]).map((it) => (
                      <Link key={it.label} href={it.href} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-white/85 hover:bg-white/[0.06]">
                        <span className="text-[15px] font-medium">{it.label}</span>
                        <svg viewBox="0 0 20 20" className="w-4 h-4 text-white/30" fill="currentColor"><path fillRule="evenodd" d="M7.3 4.3a1 1 0 011.4 0l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.4-1.4L11.6 10 7.3 5.7a1 1 0 010-1.4z" clipRule="evenodd" /></svg>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <Link href="/pricing" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-[15px] font-medium text-white/85 hover:bg-white/[0.06]">Pricing</Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Link href="/login" onClick={() => setOpen(false)} className="rd-btn rd-btn-ghost-d w-full">Log in</Link>
              <Link href="/cards/new" onClick={() => setOpen(false)} className="rd-btn rd-btn-primary w-full">Get started</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
