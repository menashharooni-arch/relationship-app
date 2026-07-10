"use client";

import { useEffect, useRef } from "react";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import { SAMPLE_DATA, withoutSocials } from "@/components/card-templates/types";

// Hero demo card — PhotoFirst template with a clearly-fictional ILLUSTRATED
// avatar (not a real person). To use a real photo later, drop a licensed image
// into public/demo/ and point photoUrl at it instead.
const HERO_DATA = { ...withoutSocials(SAMPLE_DATA), photoUrl: "/demo/avatar.svg" };

// How far the phone folds down at full scroll progress.
const FOLD_X = 74;   // deg — tips forward around the X axis, falling onto its screen
const HOVER_MAX = 7; // deg — cursor tilt, layered on top (fades out as it folds)

// Crisp, front-facing phone that (1) gently floats, (2) tilts toward the cursor,
// and (3) FOLDS DOWN as the page scrolls — pivoting at its bottom edge and
// tipping forward like it's falling flat onto its screen. Driven directly by
// scroll position and smoothed with a lerp, so scrolling back up stands it
// upright again just as fluidly. All transform writes happen imperatively in
// one rAF loop (no re-render per frame).
export default function HeroPhone() {
  const wrapRef = useRef<HTMLDivElement>(null);  // measures scroll progress
  const stageRef = useRef<HTMLDivElement>(null); // receives the transform

  useEffect(() => {
    const wrap = wrapRef.current;
    const stage = stageRef.current;
    if (!wrap || !stage) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Targets (set by scroll + mouse) and currents (eased toward targets).
    let targetP = 0, curP = 0;        // scroll flip progress 0..1
    let targetRx = 0, targetRy = 0;   // hover tilt
    let curRx = 0, curRy = 0;
    let raf: number | null = null;
    let running = true;

    // Scroll progress: 0 with the hero at rest at the top of the page → 1 once
    // the user has scrolled ~70% of a viewport. Reading scrollY directly (not a
    // one-shot observer) is what ties the flip to the scroll position both ways.
    const progress = () => {
      const range = window.innerHeight * 0.7;
      const y = window.scrollY || 0;
      return Math.min(1, Math.max(0, y / range));
    };

    const onMove = (e: MouseEvent) => {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = (e.clientX - r.left) / r.width - 0.5; // -0.5 … 0.5
      const py = (e.clientY - r.top) / r.height - 0.5;
      targetRx = -py * HOVER_MAX;
      targetRy = px * HOVER_MAX;
    };
    const onLeave = () => { targetRx = 0; targetRy = 0; };

    const frame = () => {
      if (!running) return;
      targetP = reduced ? 0 : progress();

      // Ease each value toward its target — high enough to feel connected to
      // the scroll, low enough to feel weighty and premium (not 1:1 jitter).
      curP += (targetP - curP) * 0.14;
      curRx += (targetRx - curRx) * 0.12;
      curRy += (targetRy - curRy) * 0.12;

      // Snap sub-pixel noise so the phone is PERFECTLY flat at rest (crisp text).
      if (Math.abs(curP - targetP) < 0.0005) curP = targetP;
      if (Math.abs(curRx - targetRx) < 0.01) curRx = targetRx;
      if (Math.abs(curRy - targetRy) < 0.01) curRy = targetRy;

      // Scroll fold: pivot at the bottom edge and tip forward (negative rotateX
      // brings the top toward the viewer) — the phone lies down onto its screen.
      // The cursor tilt fades out as it folds so nothing fights the motion.
      const hoverFade = 1 - curP;
      const rx = curP * -FOLD_X + curRx * hoverFade;
      const ry = curRy * hoverFade;
      const scale = 1 - curP * 0.03;

      stage.style.transform =
        `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale.toFixed(3)})`;

      raf = requestAnimationFrame(frame);
    };

    stage.addEventListener("mousemove", onMove);
    stage.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      if (raf != null) cancelAnimationFrame(raf);
      stage.removeEventListener("mousemove", onMove);
      stage.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="sc-fade-in relative hidden lg:flex items-center justify-center"
      style={{ perspective: "1300px" }}
    >
      {/* Ambient glow */}
      <div
        className="sc-phone-glow absolute w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(29,78,216,0.30) 0%, transparent 70%)", filter: "blur(48px)" }}
      />

      {/* 3D stage — scroll fold + cursor tilt are composed here each frame.
          transform-origin near the bottom edge = the phone tips over from its
          base instead of spinning in place. */}
      <div
        ref={stageRef}
        className="relative"
        style={{ width: "320px", transformStyle: "preserve-3d", willChange: "transform", transformOrigin: "50% 92%" }}
      >
        {/* Bob — gentle vertical float (translateY only, stays crisp) */}
        <div className="sc-phone-bob relative">
          {/* Phone shell */}
          <div
            className="relative rounded-[3rem]"
            style={{
              background: "#0f172a",
              padding: "12px",
              border: "2px solid #1e293b",
              boxShadow: "0 40px 80px -24px rgba(15,23,42,0.45), 0 8px 24px -8px rgba(29,78,216,0.25)",
            }}
          >
            {/* Dynamic island */}
            <div className="absolute top-[14px] left-1/2 -translate-x-1/2 rounded-full z-20" style={{ width: "80px", height: "22px", background: "#0f172a" }} />
            {/* Side buttons */}
            <div className="absolute -right-[3px] top-28 w-[3px] h-10 rounded-r-full" style={{ background: "#1e293b" }} />
            <div className="absolute -left-[3px] top-20 w-[3px] h-7 rounded-l-full" style={{ background: "#1e293b" }} />
            <div className="absolute -left-[3px] top-32 w-[3px] h-7 rounded-l-full" style={{ background: "#1e293b" }} />

            {/* Screen */}
            <div className="relative overflow-hidden" style={{ borderRadius: "2.5rem", height: "600px", background: "#FAF7F2" }}>
              {/* Glass sheen */}
              <div className="absolute inset-0 pointer-events-none z-10" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 32%)" }} />
              {/* Card page content — mirrors the real public card page */}
              <div style={{ padding: "44px 12px 0" }}>
                {/* The live business card */}
                <div style={{ height: "150px", overflow: "hidden", marginBottom: "9px", borderRadius: "12px" }}>
                  <div style={{ width: "390px", transform: "scale(0.69)", transformOrigin: "top left" }}>
                    <PhotoFirst data={HERO_DATA} />
                  </div>
                </div>

                {/* Save contact */}
                <div style={{ background: "#1D4ED8", color: "#fff", borderRadius: "99px", padding: "9px 0", textAlign: "center", fontSize: "11px", fontWeight: 700, marginBottom: "7px", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: "12px", height: "12px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21v-8H5v8M5 3h11l3 3v3M9 3v4h6" />
                  </svg>
                  Save Alex&apos;s contact
                </div>

                {/* Connect row */}
                <div style={{ display: "flex", gap: "5px", marginBottom: "7px" }}>
                  {[
                    { label: "LinkedIn", color: "#0A66C2" },
                    { label: "Instagram", color: "#E1306C" },
                    { label: "Website", color: "#1D4ED8" },
                  ].map((c) => (
                    <div key={c.label} style={{ flex: 1, height: "26px", borderRadius: "8px", background: c.color + "14", border: `1px solid ${c.color}33`, color: c.color, fontSize: "8.5px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {c.label}
                    </div>
                  ))}
                </div>

                {/* Share your info form */}
                <div style={{ background: "#EDE5D8", borderRadius: "12px", padding: "10px", border: "1px solid #D4C8B8" }}>
                  <p style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", margin: "0 0 7px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Share your info with Alex
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {["Full name", "Email address", "Phone number"].map((ph) => (
                      <div key={ph} style={{ height: "26px", background: "#fff", borderRadius: "7px", border: "1px solid #D4C8B8", display: "flex", alignItems: "center", padding: "0 9px", fontSize: "9px", color: "#9ca3af" }}>
                        {ph}
                      </div>
                    ))}
                    <div style={{ height: "28px", background: "#1D4ED8", color: "#fff", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9.5px", fontWeight: 700 }}>
                      Share my info →
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Soft grounded shadow */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 rounded-full blur-2xl opacity-25" style={{ width: "230px", height: "26px", background: "#1D4ED8" }} />
        </div>
      </div>
    </div>
  );
}
