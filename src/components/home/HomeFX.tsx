"use client";

// ── Homepage FX toolkit ──────────────────────────────────────────────────────
// Small, dependency-free client components that give the marketing site its
// energy: infinite marquees, 3D tilt cards, an accordion FAQ, and a phone
// shell for feature mockups. All animation is CSS-driven (keyframes live in
// globals.css) so it stays 60fps and respects prefers-reduced-motion.

import { useRef, useState } from "react";

// Infinite horizontal marquee. Content is duplicated once; CSS translates the
// track -50% and loops. `reverse` flips direction; hover pauses.
export function Marquee({
  children,
  speed = 30,
  reverse = false,
  className = "",
}: {
  children: React.ReactNode;
  speed?: number; // seconds per loop
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div className={`sc-marquee ${className}`}>
      <div
        className="sc-marquee-track"
        style={{
          animationDuration: `${speed}s`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        <div className="sc-marquee-group">{children}</div>
        <div className="sc-marquee-group" aria-hidden>{children}</div>
      </div>
    </div>
  );
}

// 3D tilt-on-hover wrapper — the same feel as the hero phone, for any card.
export function TiltCard({
  children,
  className = "",
  max = 8,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-4px)`;
  }
  function onLeave() {
    const el = ref.current;
    if (el) el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)";
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`sc-tilt ${className}`}
    >
      {children}
    </div>
  );
}

// Accordion FAQ — smooth height animation via CSS grid rows trick.
export function FAQAccordion({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-3">
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div
            key={f.q}
            className={`rounded-2xl border transition-colors ${isOpen ? "bg-warm-card border-brand/40 shadow-sm" : "bg-warm-card/60 border-warm-card-border hover:border-slate-300"}`}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 text-left px-5 sm:px-6 py-4.5 py-5"
            >
              <span className="text-slate-900 font-semibold text-[15px]">{f.q}</span>
              <span
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? "bg-brand text-white rotate-45" : "bg-slate-900/5 text-slate-500"}`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
              </span>
            </button>
            <div className={`sc-acc ${isOpen ? "sc-acc-open" : ""}`}>
              <div className="overflow-hidden">
                <p className="px-5 sm:px-6 pb-5 text-slate-500 text-sm leading-relaxed">{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// A compact phone frame for feature mockups — same design language as the
// hero phone, sized for section visuals. Screen content comes as children.
export function PhoneShell({
  children,
  className = "",
  float = true,
}: {
  children: React.ReactNode;
  className?: string;
  float?: boolean;
}) {
  return (
    <div className={`${float ? "sc-phone-bob" : ""} relative w-[270px] ${className}`}>
      <div
        className="relative rounded-[2.6rem]"
        style={{
          background: "#0f172a",
          padding: "10px",
          border: "2px solid #1e293b",
          boxShadow: "0 36px 70px -22px rgba(15,23,42,0.42), 0 8px 22px -8px rgba(29,78,216,0.22)",
        }}
      >
        <div className="absolute top-[11px] left-1/2 -translate-x-1/2 rounded-full z-20" style={{ width: 68, height: 19, background: "#0f172a" }} />
        <div className="relative overflow-hidden" style={{ borderRadius: "2.1rem", height: 500, background: "#FAF7F2" }}>
          <div className="absolute inset-0 pointer-events-none z-10" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 30%)" }} />
          {children}
        </div>
      </div>
    </div>
  );
}
