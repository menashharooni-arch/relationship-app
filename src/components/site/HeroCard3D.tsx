"use client";

import { useRef } from "react";
import SwiftCardVisual from "./SwiftCardVisual";

// The flagship hero card: floats gently and tilts toward the cursor in real 3D.
// Pointer math is written straight to the transform (no per-frame React state)
// so it stays buttery and crisp. Eases back to flat when the cursor leaves.
export default function HeroCard3D() {
  const stage = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const MAX = 12;
    el.style.transform = `rotateY(${px * MAX}deg) rotateX(${-py * MAX}deg) translateZ(30px)`;
  }
  function onLeave() {
    const el = stage.current;
    if (el) el.style.transform = "rotateY(0) rotateX(0) translateZ(0)";
  }

  return (
    <div className="relative" style={{ perspective: 1400 }}>
      {/* aurora glows behind the card */}
      <div className="rd-glow rd-glow-violet rd-drift-a" style={{ width: 360, height: 360, left: "-14%", top: "-16%" }} />
      <div className="rd-glow rd-glow-cyan rd-drift-b" style={{ width: 320, height: 320, right: "-16%", bottom: "-10%" }} />

      <div
        ref={stage}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="sc-phone-bob relative w-[300px] sm:w-[340px] mx-auto"
        style={{ transformStyle: "preserve-3d", transition: "transform .5s cubic-bezier(.2,.7,.2,1)", willChange: "transform" }}
      >
        <SwiftCardVisual />
        {/* floating "tap to share" chip */}
        <div
          className="absolute -right-6 top-8 rounded-2xl border border-white/15 bg-[#0E1017]/90 backdrop-blur px-3.5 py-2 shadow-xl"
          style={{ transform: "translateZ(60px)" }}
        >
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--rd-aurora)" }}>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="text-white text-[12px] font-semibold leading-tight">Saved to<br />contacts</span>
          </div>
        </div>
        {/* floating NFC chip */}
        <div
          className="absolute -left-7 bottom-16 rounded-2xl border border-white/15 bg-[#0E1017]/90 backdrop-blur px-3 py-2 shadow-xl"
          style={{ transform: "translateZ(48px)" }}
        >
          <div className="flex items-center gap-2 text-white">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-sky-300" fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M6 8a8 8 0 000 8M9.5 6a12 12 0 000 12M13 4.5a16 16 0 000 15" strokeLinecap="round" /></svg>
            <span className="text-[12px] font-semibold">One tap</span>
          </div>
        </div>
      </div>
    </div>
  );
}
