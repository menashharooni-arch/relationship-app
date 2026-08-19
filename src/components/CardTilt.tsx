"use client";

import { useRef } from "react";

// ── The card leans toward the cursor ─────────────────────────────────────────
//
// Desktop-only physicality for the public card page's hero: the card is the
// page's one real object, and a few degrees of perspective tilt under the
// pointer makes it read as a thing you could pick up. Deliberately subtle
// (±3.5°), springs back on leave, and stays completely inert for touch
// pointers and reduced-motion visitors — a phone visitor scrolling past must
// never see the card wobble under their thumb.

const MAX_DEG = 3.5;

export default function CardTilt({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;  // -0.5 .. 0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * MAX_DEG * 2).toFixed(2)}deg) rotateY(${(px * MAX_DEG * 2).toFixed(2)}deg)`;
  }

  function onLeave() {
    const el = ref.current;
    if (el) el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)", willChange: "transform" }}
    >
      {children}
    </div>
  );
}
