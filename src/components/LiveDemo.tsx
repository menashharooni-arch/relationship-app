"use client";

import { useState, useEffect } from "react";
import ClassicPro from "@/components/card-templates/ClassicPro";
import { SAMPLE_DATA, withoutSocials } from "@/components/card-templates/types";

const SCREENS = [
  {
    label: "Share your card",
    sublabel: "Send by link, QR, or NFC tap",
    content: <ShareScreen />,
  },
  {
    label: "Card opens instantly",
    sublabel: "No app — works in any browser",
    content: <CardScreen />,
  },
  {
    label: "They save your contact",
    sublabel: "One tap adds you to their phone",
    content: <SaveScreen />,
  },
  {
    label: "You get notified",
    sublabel: "Real-time lead in your dashboard",
    content: <NotifyScreen />,
  },
];

function ShareScreen() {
  return (
    <div className="flex flex-col h-full bg-[#FAF7F2] px-4 pt-8 pb-4">
      <p className="text-[10px] text-slate-400 uppercase tracking-widest text-center mb-5 font-semibold">Messages</p>

      {/* Incoming message bubble */}
      <div className="flex flex-col gap-3 flex-1">
        <div className="self-start max-w-[85%]">
          <div className="rounded-2xl rounded-tl-sm px-3 py-2.5" style={{ background: "#E8E8ED" }}>
            <p className="text-[11px] text-slate-800 leading-snug">Hey! Great meeting you at the conference 🤝</p>
          </div>
          <p className="text-[9px] text-slate-400 mt-1 ml-1">Alex · 2:14 PM</p>
        </div>

        <div className="self-end max-w-[85%]">
          <div className="rounded-2xl rounded-tr-sm px-3 py-2.5" style={{ background: "#1D4ED8" }}>
            <p className="text-[11px] text-white leading-snug">You too! Here&apos;s my card:</p>
          </div>
        </div>

        <div className="self-end max-w-[88%]">
          <div className="rounded-2xl rounded-tr-sm px-3 py-2.5" style={{ background: "#1D4ED8" }}>
            <p className="text-[10px] text-blue-200 underline leading-snug">swiftcard.me/card/alexmorgan</p>
          </div>
          <p className="text-[9px] text-slate-400 mt-1 text-right mr-1">2:14 PM · Delivered</p>
        </div>

        {/* Link preview card */}
        <div className="self-end w-full rounded-xl overflow-hidden shadow-sm" style={{ border: "1px solid #D4C8B8" }}>
          <div className="h-8 flex items-center px-3 gap-1.5" style={{ background: "#E8ECF5" }}>
            <div className="w-3.5 h-3.5 rounded-sm" style={{ background: "#1D4ED8" }} />
            <p className="text-[9px] font-semibold text-slate-700 truncate">swiftcard.me/card/alexmorgan</p>
          </div>
          <div className="px-3 py-2" style={{ background: "#fff" }}>
            <p className="text-[10px] font-bold text-slate-900">Alex Morgan · Founder & CEO</p>
            <p className="text-[9px] text-slate-500">Tap to view card &amp; save contact</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardScreen() {
  return (
    <div className="flex flex-col h-full" style={{ background: "#FAF7F2" }}>
      {/* Browser bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 shrink-0" style={{ background: "#F5F0E8", borderBottom: "1px solid #E4DDD4" }}>
        <div className="flex gap-1 shrink-0">
          <div className="w-2 h-2 rounded-full" style={{ background: "#FF5F57" }} />
          <div className="w-2 h-2 rounded-full" style={{ background: "#FFBD2E" }} />
          <div className="w-2 h-2 rounded-full" style={{ background: "#28CA41" }} />
        </div>
        <div className="flex-1 mx-1.5 bg-white rounded-md px-2 py-0.5" style={{ border: "1px solid #E4DDD4" }}>
          <span className="text-[7.5px] text-slate-400">swiftcard.me/<strong className="text-slate-600">alexmorgan</strong></span>
        </div>
      </div>

      {/* Card content */}
      <div className="flex-1 overflow-hidden px-3 pt-3 pb-2 flex flex-col gap-2.5">
        {/* Actual ClassicPro template scaled to fit the ~196px-wide card slot.
            390px design width × 0.5 = 195px wide, (390/1.75)×0.5 ≈ 111px tall —
            so nothing (right-edge QR or bottom row) gets clipped. */}
        <div className="shrink-0 rounded-xl overflow-hidden" style={{ height: "112px" }}>
          <div style={{ width: "390px", transform: "scale(0.5)", transformOrigin: "top left" }}>
            <ClassicPro data={withoutSocials(SAMPLE_DATA)} />
          </div>
        </div>

        {/* Save button */}
        <div className="rounded-xl py-2 text-center text-white text-[10px] font-bold shrink-0 flex items-center justify-center gap-1.5" style={{ background: "#1D4ED8" }}>
          <svg viewBox="0 0 16 16" fill="white" className="w-3 h-3"><path d="M6 1a1 1 0 000 2h1v1H3a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2H9V3h1a1 1 0 100-2H6zm3 5H7a1 1 0 100 2h2a1 1 0 100-2z"/></svg>
          Save Contact
        </div>

        {/* Share your info */}
        <div className="rounded-xl p-2.5 shrink-0" style={{ background: "#EDE5D8", border: "1px solid #D4C8B8" }}>
          <p className="text-[8.5px] font-semibold text-slate-600 mb-1.5">Share your info with Alex →</p>
          <div className="space-y-1.5">
            <div className="h-5 rounded-lg" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid #D4C8B8" }} />
            <div className="h-5 rounded-lg" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid #D4C8B8" }} />
            <div className="h-5 rounded-full" style={{ background: "#1D4ED8" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveScreen() {
  const [tapped, setTapped] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTapped(true), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col h-full items-center justify-center px-5 gap-5" style={{ background: "#FAF7F2" }}>
      <div className="text-center">
        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold mb-3">Contacts</p>
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg transition-all duration-500"
          style={{ background: tapped ? "#16a34a" : "#1D4ED8", transform: tapped ? "scale(1.08)" : "scale(1)" }}
        >
          {tapped ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          )}
        </div>

        <p className="text-slate-900 font-bold text-sm transition-all duration-300">
          {tapped ? "Contact saved! ✓" : "Saving contact…"}
        </p>
        <p className="text-slate-400 text-[10px] mt-1">
          {tapped ? "Alex Morgan added to your phone" : "Adding to your contacts"}
        </p>
      </div>

      {tapped && (
        <div className="w-full rounded-xl p-3 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: "#1D4ED8" }}>AM</div>
            <div>
              <p className="text-slate-900 text-[11px] font-semibold">Alex Morgan</p>
              <p className="text-slate-400 text-[9px]">alex@morganandco.com</p>
              <p className="text-slate-400 text-[9px]">(555) 123-4567</p>
            </div>
            <div className="ml-auto">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#E8F5E9" }}>
                <svg viewBox="0 0 20 20" fill="#16a34a" className="w-4 h-4">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotifyScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: "#111827" }}>
      {/* Dashboard header */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between" style={{ borderBottom: "1px solid #1f2937" }}>
        <p className="text-white text-[10px] font-bold">Dashboard</p>
        <div className="relative">
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#1f2937" }}>
            <svg viewBox="0 0 20 20" fill="#9ca3af" className="w-3 h-3">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
          </div>
          {show && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full flex items-center justify-center text-[6px] font-black text-white" style={{ background: "#ef4444" }}>1</div>}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1.5 px-3 pt-2.5 pb-2">
        {[["12", "Leads"], ["47", "Views"], ["3×", "Follow-ups"]].map(([v, l]) => (
          <div key={l} className="rounded-xl px-2 py-2 text-center" style={{ background: "#1f2937", border: "1px solid #374151" }}>
            <p className="text-white font-bold text-[12px]">{v}</p>
            <p className="text-gray-500 text-[7px] mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Push notification banner */}
      <div
        className="mx-3 rounded-xl px-3 py-2.5 flex items-start gap-2.5 shadow-lg transition-all duration-500"
        style={{
          background: show ? "#1D4ED8" : "transparent",
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(-8px)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
          <span className="text-sm">🎉</span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-[10px]">New lead captured!</p>
          <p className="text-blue-200 text-[9px] leading-snug mt-0.5">Sarah Williams shared her info via your Instagram bio link</p>
          <p className="text-blue-300/70 text-[8px] mt-1">just now · tap to view</p>
        </div>
      </div>

      {/* Lead list */}
      <div className="flex-1 px-3 pt-2 space-y-1.5 overflow-hidden">
        {[
          { name: "Sarah Williams", src: "Instagram bio", time: "just now", hot: true },
          { name: "John Chicoine", src: "QR code scan", time: "2h ago", hot: false },
          { name: "Jubin Kalimian", src: "Direct link", time: "Yesterday", hot: false },
        ].map((lead, i) => (
          <div
            key={lead.name}
            className="flex items-center gap-2 rounded-xl px-2.5 py-2 transition-all duration-300"
            style={{
              background: i === 0 && show ? "#1e3a5f" : "#1f2937",
              border: `1px solid ${i === 0 && show ? "#1D4ED8" : "#374151"}`,
              opacity: show || i > 0 ? 1 : 0,
              transitionDelay: `${i * 100}ms`,
            }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[8px] shrink-0" style={{ background: ["#1D4ED8", "#7c3aed", "#059669"][i] }}>
              {lead.name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-[9px] font-semibold truncate">{lead.name}</p>
              <p className="text-gray-500 text-[8px] truncate">{lead.src}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-gray-500 text-[7.5px]">{lead.time}</p>
              {lead.hot && <span className="text-[7px] font-black px-1 py-0.5 rounded-full" style={{ background: "#450a0a", color: "#f87171" }}>NEW</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LiveDemo() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setActive((a) => (a + 1) % SCREENS.length);
    }, 3000);
    return () => clearInterval(t);
  }, [paused]);

  function go(i: number) {
    setActive(i);
    setPaused(true);
    setTimeout(() => setPaused(false), 6000);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

      {/* Left: animated phone */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-64 h-64 rounded-full opacity-15 blur-3xl" style={{ background: "radial-gradient(circle, #1D4ED8 0%, transparent 70%)" }} />

        <div className="relative" style={{ width: "240px" }}>
          {/* Phone shell */}
          <div
            className="relative rounded-[2.8rem] shadow-2xl overflow-hidden"
            style={{ background: "#0f172a", padding: "10px", border: "2px solid #1e293b" }}
          >
            {/* Dynamic island */}
            <div className="absolute top-[12px] left-1/2 -translate-x-1/2 rounded-full z-20" style={{ width: "72px", height: "20px", background: "#0f172a" }} />
            {/* Side buttons */}
            <div className="absolute -right-[3px] top-24 w-[3px] h-9 rounded-r-full" style={{ background: "#1e293b" }} />
            <div className="absolute -left-[3px] top-16 w-[3px] h-6 rounded-l-full" style={{ background: "#1e293b" }} />
            <div className="absolute -left-[3px] top-28 w-[3px] h-6 rounded-l-full" style={{ background: "#1e293b" }} />

            {/* Screen */}
            <div className="overflow-hidden" style={{ borderRadius: "2.3rem", height: "460px" }}>
              {/* Progress bar */}
              <div className="h-1 w-full" style={{ background: "#1e293b" }}>
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    background: "#1D4ED8",
                    width: `${((active + 1) / SCREENS.length) * 100}%`,
                  }}
                />
              </div>

              {/* Screen content — key forces re-mount for animations */}
              <div key={active} className="h-full" style={{ animation: "fadeSlideIn 0.35s ease" }}>
                {SCREENS[active].content}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: step selector */}
      <div className="space-y-3">
        <div className="mb-6">
          <p className="text-[11px] font-bold tracking-[0.25em] text-brand uppercase mb-3">Live Demo</p>
          <h2 className="text-3xl font-bold text-slate-900">See every step live</h2>
          <p className="text-slate-500 mt-2 text-sm">Click any step to jump to it, or watch it play automatically.</p>
        </div>

        {SCREENS.map((s, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className="w-full text-left flex items-center gap-4 px-5 py-4 rounded-2xl transition-all"
            style={{
              background: active === i ? "#EBF0FF" : "transparent",
              border: `1.5px solid ${active === i ? "#1D4ED8" : "#E4DDD4"}`,
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black transition-all"
              style={{
                background: active === i ? "#1D4ED8" : "#E8ECF5",
                color: active === i ? "#fff" : "#94a3b8",
              }}
            >
              {i + 1}
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: active === i ? "#1D4ED8" : "#0f172a" }}>{s.label}</p>
              <p className="text-slate-400 text-xs mt-0.5">{s.sublabel}</p>
            </div>
            {active === i && !paused && (
              <div className="ml-auto flex items-center gap-1 shrink-0">
                {[0, 1, 2].map(d => (
                  <div key={d} className="w-1 h-1 rounded-full" style={{ background: "#1D4ED8", opacity: 0.4 + d * 0.3, animation: `pulse 1s ${d * 0.2}s infinite` }} />
                ))}
              </div>
            )}
          </button>
        ))}

        {/* Dot nav */}
        <div className="flex items-center gap-2 pt-2">
          {SCREENS.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className="rounded-full transition-all"
              style={{
                width: active === i ? "24px" : "8px",
                height: "8px",
                background: active === i ? "#1D4ED8" : "#D4C8B8",
              }}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
