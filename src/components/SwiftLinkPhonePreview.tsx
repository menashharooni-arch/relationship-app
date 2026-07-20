"use client";

import { useEffect, useRef, useState } from "react";
import PhoneFrame from "@/components/PhoneFrame";
import { IcoInsta, IcoLinkedIn, IcoX, IcoTikTok } from "@/components/card-templates/shared";

// "How SwiftLink looks" — an interactive, fully self-contained Swift Links
// (link-in-bio) preview inside a phone. Uses clearly-sample data and fires NO
// network requests, so it never pollutes real card-view / card-event analytics.
// Buttons are genuinely clickable: tapping one gives a pressed state + an honest
// "preview" note so nothing pretends to be live production data.

const SOCIALS = [
  { key: "instagram", label: "Instagram", node: <IcoInsta />, color: "#E1306C" },
  { key: "linkedin", label: "LinkedIn", node: <IcoLinkedIn />, color: "#0A66C2" },
  { key: "twitter", label: "X", node: <IcoX />, color: "#0f172a" },
  { key: "tiktok", label: "TikTok", node: <IcoTikTok />, color: "#0f172a" },
];

const LINKS = [
  { label: "Book a 15-min call", sub: "calendly · sample" },
  { label: "Latest listings", sub: "my featured homes" },
  { label: "My website", sub: "morganandco.com" },
  { label: "Save my contact", sub: "adds me to your phone", primary: true },
];

export default function SwiftLinkPhonePreview({ width = 340 }: { width?: number }) {
  const [tapped, setTapped] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function tap(label: string) {
    setTapped(label);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setTapped(null), 1600);
  }

  return (
    <PhoneFrame
      width={width}
      ariaLabel="Interactive preview of a SwiftCard Swift Links page on a phone"
      screenStyle={{ height: "min(660px, 76vh)", background: "#FAF7F2" }}
    >
      <div className="flex flex-col h-full">
        {/* Browser chrome */}
        <div className="shrink-0 flex items-center gap-1.5 px-4 pt-3.5 pb-2" style={{ background: "#F5F0E8", borderBottom: "1px solid #E4DDD4" }}>
          <div className="flex gap-1 shrink-0" aria-hidden>
            <div className="w-2 h-2 rounded-full" style={{ background: "#FF5F57" }} />
            <div className="w-2 h-2 rounded-full" style={{ background: "#FFBD2E" }} />
            <div className="w-2 h-2 rounded-full" style={{ background: "#28CA41" }} />
          </div>
          <div className="flex-1 mx-1 bg-white rounded-md px-2.5 py-1 text-center" style={{ border: "1px solid #E4DDD4" }}>
            <span className="text-[9px] text-slate-500">swiftcard.me/links/<strong className="text-slate-700">alexmorgan</strong></span>
          </div>
        </div>

        {/* Scroll-contained links page */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-6 pb-8">
          <div className="flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/demo/avatar.svg" alt="Sample profile avatar" className="w-20 h-20 rounded-full object-cover ring-2 ring-white shadow-md" style={{ background: "#e9eefc" }} />
            <p className="mt-3 text-slate-900 font-bold text-lg leading-tight">Alex Morgan</p>
            <p className="text-slate-500 text-xs mt-0.5">Founder &amp; CEO · Morgan &amp; Co.</p>
            <p className="text-slate-600 text-[12px] mt-3 leading-relaxed max-w-[240px]">
              Helping brands grow. Tap a link below to connect — this is a sample preview.
            </p>

            {/* Socials */}
            <div className="flex items-center gap-3 mt-4">
              {SOCIALS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => tap(s.label)}
                  aria-label={`${s.label} (preview)`}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-[#E4DDD4] shadow-sm active:scale-95 transition-transform"
                  style={{ color: s.color }}
                >
                  <span className="scale-[1.6] flex" aria-hidden>{s.node}</span>
                </button>
              ))}
            </div>

            {/* Link buttons */}
            <div className="w-full space-y-2.5 mt-6">
              {LINKS.map((l) => (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => tap(l.label)}
                  className={`w-full rounded-2xl px-4 py-3 text-left transition-all active:scale-[0.98] border ${
                    l.primary
                      ? "bg-[#1D4ED8] border-[#1D4ED8] text-white shadow-md"
                      : "bg-white border-[#E4DDD4] text-slate-800 hover:border-[#1D4ED8]/40"
                  }`}
                >
                  <span className="block text-sm font-semibold leading-tight">{l.label}</span>
                  <span className={`block text-[11px] mt-0.5 ${l.primary ? "text-blue-100" : "text-slate-400"}`}>{l.sub}</span>
                </button>
              ))}
            </div>

            <p className="text-slate-400 text-[10px] mt-6 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#1D4ED8" }} />
              Made with SwiftCard
            </p>
          </div>
        </div>

        {/* Honest interaction toast */}
        <div
          aria-live="polite"
          className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center transition-all duration-200"
          style={{ opacity: tapped ? 1 : 0, transform: tapped ? "translateY(0)" : "translateY(8px)" }}
        >
          <div className="rounded-full bg-gray-900/95 text-white text-[11px] font-medium px-4 py-2 shadow-lg max-w-[85%] text-center">
            {tapped ? `“${tapped}” — this preview shows where your real link opens` : ""}
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
