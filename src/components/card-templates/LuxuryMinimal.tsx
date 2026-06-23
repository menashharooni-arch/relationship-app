import React from "react";
import type { CardData } from "./types";

const GOLD = "#C9A96E";
const GOLD_DARK = "#A07840";

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

export default function LuxuryMinimal({ data }: { data: CardData }) {
  const socials = [
    data.instagram && { icon: <Insta />, label: data.instagram },
    data.twitter && { icon: <XIcon />, label: data.twitter },
    data.tiktok && { icon: <TikTok />, label: data.tiktok },
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[];

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-lg flex"
      style={{ aspectRatio: "1.75 / 1", background: "#F8F6F2" }}
    >
      {/* Left gold accent strip */}
      <div
        className="shrink-0"
        style={{
          width: 4,
          background: `linear-gradient(to bottom, ${GOLD}, ${GOLD_DARK}, transparent)`,
        }}
      />

      {/* Left panel */}
      <div
        className="flex flex-col justify-between py-6 pl-5 pr-4"
        style={{ width: "38%", borderRight: `1px solid ${GOLD}22` }}
      >
        {/* Top: logo or initials */}
        <div>
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded" style={{ opacity: 0.85 }} />
          ) : (
            <div
              className="font-light select-none"
              style={{
                fontSize: "clamp(28px, 7vw, 52px)",
                color: `${GOLD}28`,
                lineHeight: 1,
                letterSpacing: "0.05em",
              }}
            >
              {data.initials ?? (data.name ?? "").split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
          )}
        </div>

        {/* Bottom: company identity + socials */}
        <div>
          <div className="w-6 h-px mb-2" style={{ background: GOLD }} />
          <p
            style={{
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: "0.3em",
              color: GOLD,
              textTransform: "uppercase",
              lineHeight: 1.4,
            }}
          >
            {data.company}
          </p>
          {socials.length > 0 ? (
            <div className="flex items-center gap-2 mt-2" style={{ color: `${GOLD}80` }}>
              {socials.map((s, i) => <span key={i}>{s.icon}</span>)}
            </div>
          ) : (
            <p style={{ fontSize: 8, color: "#b8a88a", letterSpacing: "0.15em", marginTop: 3 }}>Est. 2018</p>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-between py-6 px-7">
        {/* Name + title */}
        <div>
          <h2
            className="text-gray-800 leading-tight"
            style={{
              fontSize: "clamp(16px, 3.5vw, 24px)",
              fontWeight: 300,
              letterSpacing: "0.03em",
            }}
          >
            {data.name}
          </h2>
          <p
            style={{
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: "0.25em",
              color: GOLD,
              textTransform: "uppercase",
              marginTop: 5,
            }}
          >
            {data.title}
          </p>
        </div>

        {/* Gold divider */}
        <div className="w-full h-px" style={{ background: `linear-gradient(to right, ${GOLD}60, transparent)` }} />

        {/* Contact */}
        <div className="flex flex-col gap-[5px]">
          {data.phone && (
            <div className="flex items-center gap-2">
              <div className="w-px h-3 shrink-0" style={{ background: GOLD }} />
              <span style={{ fontSize: 10, color: "#6b5e4e", letterSpacing: "0.05em" }}>{data.phone}</span>
            </div>
          )}
          {data.email && (
            <div className="flex items-center gap-2">
              <div className="w-px h-3 shrink-0" style={{ background: GOLD }} />
              <span className="truncate" style={{ fontSize: 10, color: "#6b5e4e", letterSpacing: "0.05em" }}>{data.email}</span>
            </div>
          )}
          {data.website && (
            <div className="flex items-center gap-2">
              <div className="w-px h-3 shrink-0" style={{ background: GOLD }} />
              <span style={{ fontSize: 10, color: "#6b5e4e", letterSpacing: "0.05em" }}>{data.website}</span>
            </div>
          )}
        </div>

        {/* Bottom: social handles or address */}
        {socials.length > 0 ? (
          <div className="flex flex-col gap-[4px]">
            {socials.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5" style={{ color: `${GOLD}80` }}>
                {s.icon}
                <span style={{ fontSize: 8.5, letterSpacing: "0.05em" }}>{s.label}</span>
              </div>
            ))}
          </div>
        ) : data.address ? (
          <p style={{ fontSize: 8.5, color: "#b8a88a", letterSpacing: "0.08em" }}>
            {data.address}
          </p>
        ) : null}
      </div>
    </div>
  );
}
