"use client";

import { useRef, useState } from "react";
import ClassicPro from "@/components/card-templates/ClassicPro";
import { SAMPLE_DATA, withoutSocials } from "@/components/card-templates/types";

// Crisp, front-facing phone that gently floats and tilts toward the cursor in 3D.
// At rest it's perfectly flat (no blur / no fixed angle); the tilt only happens
// on hover and eases back to flat.
export default function HeroPhone() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;   // -0.5 … 0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    const MAX = 7; // degrees — subtle
    setTilt({ rx: +(-py * MAX).toFixed(2), ry: +(px * MAX).toFixed(2) });
  }

  return (
    <div
      className="sc-fade-in relative hidden lg:flex items-center justify-center"
      style={{ perspective: "1300px" }}
    >
      {/* Ambient glow */}
      <div
        className="sc-phone-glow absolute w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(29,78,216,0.30) 0%, transparent 70%)", filter: "blur(48px)" }}
      />

      {/* Tilt stage — front-facing at rest, follows the cursor on hover */}
      <div
        ref={stageRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
        className="relative"
        style={{
          width: "320px",
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: "transform .4s cubic-bezier(.2,.7,.2,1)",
        }}
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
              {/* Browser bar */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ background: "#F0EBE1", borderColor: "#E4DDD4" }}>
                <div className="flex gap-1 shrink-0">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
              </div>

              {/* Card page content */}
              <div style={{ padding: "12px 12px 0" }}>
                <div style={{ height: "156px", overflow: "hidden", marginBottom: "10px", borderRadius: "12px" }}>
                  <div style={{ width: "390px", transform: "scale(0.69)", transformOrigin: "top left" }}>
                    <ClassicPro data={withoutSocials(SAMPLE_DATA)} />
                  </div>
                </div>

                <div style={{ background: "#1D4ED8", color: "#fff", borderRadius: "99px", padding: "9px 0", textAlign: "center", fontSize: "11px", fontWeight: 700, marginBottom: "8px" }}>
                  💾 Save Alex&apos;s contact
                </div>

                <div style={{ background: "#EDE5D8", borderRadius: "12px", padding: "10px", border: "1px solid #D4C8B8" }}>
                  <p style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", margin: "0 0 7px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Share your info with Alex →
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ height: "24px", background: "#fff", borderRadius: "7px", border: "1px solid #D4C8B8" }} />
                    <div style={{ height: "24px", background: "#fff", borderRadius: "7px", border: "1px solid #D4C8B8" }} />
                    <div style={{ height: "24px", background: "#1D4ED8", borderRadius: "7px" }} />
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
