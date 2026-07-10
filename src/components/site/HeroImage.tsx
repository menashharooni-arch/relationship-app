"use client";

import { useRef } from "react";

// Hero visual — a user-supplied product photo, framed and gently tilting toward
// the cursor in real 3D (eases back to flat when the cursor leaves).
export default function HeroImage() {
  const stage = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const MAX = 8;
    el.style.transform = `rotateY(${px * MAX}deg) rotateX(${-py * MAX}deg) translateZ(24px)`;
  }
  function onLeave() {
    const el = stage.current;
    if (el) el.style.transform = "rotateY(0) rotateX(0) translateZ(0)";
  }

  return (
    <div className="relative w-full flex justify-center lg:justify-end" style={{ perspective: 1500 }}>
      {/* ambient blue glows */}
      <div className="rd-glow rd-glow-blue rd-drift-a" style={{ width: 460, height: 460, right: "-6%", top: "-12%", opacity: 0.5 }} />
      <div className="rd-glow rd-glow-cyan rd-drift-b" style={{ width: 320, height: 320, left: "-6%", bottom: "-10%", opacity: 0.38 }} />

      <div
        ref={stage}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="sc-phone-bob relative w-full max-w-[560px]"
        style={{ transformStyle: "preserve-3d", transition: "transform .5s cubic-bezier(.2,.7,.2,1)", willChange: "transform" }}
      >
        <div className="rounded-[28px] overflow-hidden border border-white/12 shadow-[0_50px_100px_-40px_rgba(0,0,0,0.75)] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/marketing/hero-share.jpg"
            alt="Two iPhones sharing a SwiftCard contact with a single tap"
            width={930}
            height={620}
            className="w-full h-auto block"
          />
        </div>
      </div>
    </div>
  );
}
