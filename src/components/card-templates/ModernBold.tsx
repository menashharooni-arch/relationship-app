import React from "react";
import type { CardData } from "./types";

const Phone = () => (
  <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);
const Mail = () => (
  <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
  </svg>
);
const Globe = () => (
  <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" />
  </svg>
);
const Insta = () => (
  <svg className="w-2.5 h-2.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
);
const XIcon = () => (
  <svg className="w-2.5 h-2.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);
const TikTok = () => (
  <svg className="w-2.5 h-2.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.76a8.16 8.16 0 004.77 1.52V6.83a4.85 4.85 0 01-1-.14z"/>
  </svg>
);

export default function ModernBold({ data }: { data: CardData }) {
  const socials = [
    data.instagram && { icon: <Insta />, label: data.instagram, color: "#c13584" },
    data.twitter && { icon: <XIcon />, label: data.twitter, color: "#94a3b8" },
    data.tiktok && { icon: <TikTok />, label: data.tiktok, color: "#94a3b8" },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; color: string }[];

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-xl flex"
      style={{ aspectRatio: "1.75 / 1", background: "#050d1a" }}
    >
      {/* Faded giant monogram in background */}
      <div
        className="absolute select-none pointer-events-none font-black leading-none"
        style={{
          fontSize: "clamp(100px, 22vw, 160px)",
          color: "rgba(59,130,246,0.06)",
          top: "50%",
          left: "-2%",
          transform: "translateY(-52%)",
          letterSpacing: "-0.05em",
        }}
      >
        {(data.name ?? "A")[0]}
      </div>

      {/* Blue diagonal accent */}
      <div
        className="absolute"
        style={{
          width: 3,
          top: 0,
          bottom: 0,
          left: "42%",
          background: "linear-gradient(to bottom, #3b82f6, #1d4ed8, transparent)",
          opacity: 0.6,
        }}
      />

      {/* Left panel */}
      <div className="w-[42%] relative flex flex-col justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          {data.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt="Logo" className="w-5 h-5 rounded object-contain shrink-0" />
          )}
          <p style={{ fontSize: 9, letterSpacing: "0.25em", color: "#4b5563", fontWeight: 700 }}>
            {(data.company ?? "").toUpperCase()}
          </p>
        </div>

        {/* Name + Title */}
        <div>
          <div className="w-5 h-px mb-3" style={{ background: "#3b82f6" }} />
          <h2 className="font-black text-white leading-tight" style={{ fontSize: "clamp(16px, 3.5vw, 26px)" }}>
            {data.name}
          </h2>
          <p style={{ fontSize: 9, color: "#3b82f6", letterSpacing: "0.18em", fontWeight: 700, marginTop: 4 }}>
            {(data.title ?? "").toUpperCase()}
          </p>
        </div>

        {socials.length > 0 && (
          <div className="flex items-center gap-2.5">
            {socials.map((s, i) => (
              <span key={i} style={{ color: s.color }}>{s.icon}</span>
            ))}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center px-6 gap-[9px]" style={{ color: "#94a3b8" }}>
        <div className="w-6 h-px mb-1" style={{ background: "#3b82f6" }} />

        {data.phone && (
          <div className="flex items-center gap-2">
            <Phone />
            <span style={{ fontSize: 11 }}>{data.phone}</span>
          </div>
        )}
        {data.email && (
          <div className="flex items-center gap-2 truncate">
            <Mail />
            <span className="truncate" style={{ fontSize: 11 }}>{data.email}</span>
          </div>
        )}
        {data.website && (
          <div className="flex items-center gap-2">
            <Globe />
            <span style={{ fontSize: 11 }}>{data.website}</span>
          </div>
        )}

        {socials.length > 0 && (
          <div className="mt-1 pt-2 flex flex-col gap-[5px]" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {socials.map((s, i) => (
              <div key={i} className="flex items-center gap-2" style={{ color: s.color }}>
                {s.icon}
                <span style={{ fontSize: 10 }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
