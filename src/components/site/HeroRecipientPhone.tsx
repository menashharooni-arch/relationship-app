"use client";

import { useRef } from "react";
import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import { SAMPLE_DATA, withoutSocials } from "@/components/card-templates/types";
import BrowserBar, { PhoneStatusBar } from "./BrowserBar";

// Hero visual: the OTHER person's phone, a second after you shared.
//
// It replaces a stock photo of two iPhones held tip-to-tip. That photo showed
// an interaction SwiftCard cannot do (phone-to-phone tap is not possible on
// iOS), showed no SwiftCard card at all, and — worst of all — implied both
// people needed something installed, which is the exact objection the hero
// copy spends its bullets denying. An image outargues a bullet every time.
//
// So the hero now shows what actually happens: a card open in a BROWSER, with
// a Save Contact button, on a phone that belongs to someone who has never
// heard of SwiftCard. The address bar is the whole argument.
//
// Cropped to two beats (card, then Save) rather than the full link experience:
// the hero has to be readable at a glance, and the scrollable version lives
// further down the page in TemplateGallery.

const CARD = withoutSocials(SAMPLE_DATA);
const FIRST = SAMPLE_DATA.name.split(" ")[0];

export default function HeroRecipientPhone() {
  const stage = useRef<HTMLDivElement>(null);

  // Same cursor-follow tilt the previous hero image had — the motion was worth
  // keeping, only the thing being tilted changed.
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
      <div className="rd-glow rd-glow-blue rd-drift-a" style={{ width: 460, height: 460, right: "-6%", top: "-12%", opacity: 0.5 }} />
      <div className="rd-glow rd-glow-cyan rd-drift-b" style={{ width: 320, height: 320, left: "-6%", bottom: "-10%", opacity: 0.38 }} />

      <div
        ref={stage}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="sc-phone-bob relative"
        style={{ transformStyle: "preserve-3d", transition: "transform .5s cubic-bezier(.2,.7,.2,1)", willChange: "transform" }}
      >
        {/* Annotation — names the address bar as the proof, so the point is not
            left to inference. Desktop only: at phone widths it would sit on top
            of the card, and the subhead already carries the same claim there. */}
        <div className="hidden lg:flex items-center absolute z-20 right-full top-[52px] mr-2 pointer-events-none" aria-hidden>
          <span
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold"
            style={{ background: "#0F172A", color: "#fff", boxShadow: "0 10px 24px -12px rgba(15,23,42,0.6)" }}
          >
            Their browser. No app.
          </span>
          <svg viewBox="0 0 40 10" className="w-8 h-2.5" fill="none" stroke="#0F172A" strokeWidth={1.6} aria-hidden>
            <path d="M0 5h34" strokeLinecap="round" />
            <path d="M30 1.5L34.5 5 30 8.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="rd-phone w-[300px] sm:w-[330px]">
          <div className="rd-phone-screen" style={{ background: "#FAF7F2" }}>
            <div className="rd-notch" />

            <PhoneStatusBar />
            <BrowserBar />

            {/* Display-only: this is a picture of the product, not the product. */}
            <div className="px-4 pt-4 pb-6" style={{ pointerEvents: "none" }}>
              <div className="mx-auto max-w-[300px] flex flex-col gap-4">
                <div className="rounded-2xl overflow-hidden">
                  <CardScaler><ClassicPro data={CARD} /></CardScaler>
                </div>

                <div className="w-full rounded-2xl p-4 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                      style={{ background: "#1D4ED8" }}
                    >
                      1
                    </span>
                    <p className="text-slate-900 font-semibold text-[13px]">Save {FIRST}&apos;s contact</p>
                  </div>
                  <div
                    className="w-full rounded-full py-2.5 text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5"
                    style={{ background: "#2563EB" }}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M19 21v-8H5v8M5 3h11l3 3v3M9 3v4h6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Save {FIRST}&apos;s contact
                  </div>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 z-10" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 26%)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
