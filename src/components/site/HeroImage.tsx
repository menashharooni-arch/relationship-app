"use client";

import { useRef } from "react";
import SwiftCardVisual from "./SwiftCardVisual";

// Hero visual — the user-supplied two-phones photo, framed and gently tilting
// toward the cursor, with two screen overlays painted on:
//   • RIGHT phone: white screen showing a SwiftCard at the top.
//   • LEFT phone:  blank screen with a green "Contact saved" button.
//
// The photo's phones sit at 3D angles, so each overlay is an absolutely-placed
// rounded panel (percent units → scales with the responsive image) rotated to
// sit on its screen. The numbers below are the ONLY things to tweak if an
// overlay needs nudging: cx/cy = center (% of image), w/h = size (% of image),
// rot = rotation in degrees.
const RIGHT = { cx: 71.5, cy: 33, w: 30, h: 40, rot: -78 };
const LEFT = { cx: 20.5, cy: 47, w: 27, h: 40, rot: -60 };

function panelStyle(p: { cx: number; cy: number; w: number; h: number; rot: number }): React.CSSProperties {
  return {
    position: "absolute",
    left: `${p.cx}%`,
    top: `${p.cy}%`,
    width: `${p.w}%`,
    height: `${p.h}%`,
    transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
    borderRadius: "14%",
    overflow: "hidden",
  };
}

export default function HeroImage() {
  const stage = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const MAX = 7;
    el.style.transform = `rotateY(${px * MAX}deg) rotateX(${-py * MAX}deg) translateZ(20px)`;
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
        <div className="relative rounded-[28px] overflow-hidden border border-white/12 shadow-[0_50px_100px_-40px_rgba(0,0,0,0.75)] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/marketing/hero-share.jpg"
            alt="Two iPhones sharing a SwiftCard contact with a single tap"
            width={930}
            height={620}
            className="w-full h-auto block"
          />

          {/* RIGHT phone — white screen with a SwiftCard at the top */}
          <div style={panelStyle(RIGHT)}>
            <div className="w-full h-full bg-white flex flex-col items-center pt-[8%] px-[7%]">
              <div className="w-full" style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>
                <SwiftCardVisual />
              </div>
            </div>
          </div>

          {/* LEFT phone — blank screen + green "Contact saved" button */}
          <div style={panelStyle(LEFT)}>
            <div className="w-full h-full bg-white flex items-center justify-center">
              <div style={{ transform: "rotate(90deg)" }}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#16a34a] text-white font-bold px-4 py-2.5 text-[13px] whitespace-nowrap shadow-lg">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Contact saved
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
