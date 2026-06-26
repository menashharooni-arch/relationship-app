// PhotoFirst — Portrait Pro
// Style: Full-height photo on the left, clean white info panel on the right
// Includes: Profile photo (full-height), name overlay, company, phone, email, website, QR
// Best for: Real estate, beauty, fitness, coaches, personal brand, healthcare

import React from "react";
import { MiniQR as QR } from "./types";
import type { CardData } from "./types";
import { formatPhone, cardPhones, cardFax, IcoPhone, IcoMail, IcoGlobe, IcoPin, IcoInsta, IcoX, IcoTikTok, IcoLinkedIn } from "./shared";

const ACCENT_DEFAULT = "#6d28d9";

export default function PhotoFirst({ data }: { data: CardData }) {
  const ACCENT = data.customization?.accentColor ?? ACCENT_DEFAULT;
  const socials = [
    data.instagram && { icon: <IcoInsta />,    color: "#c084fc" },
    data.twitter   && { icon: <IcoX />,        color: "#64748b" },
    data.tiktok    && { icon: <IcoTikTok />,   color: "#64748b" },
    data.linkedin  && { icon: <IcoLinkedIn />, color: "#818cf8" },
  ].filter(Boolean) as { icon: React.ReactNode; color: string }[];

  return (
    <div
      className="relative w-full flex rounded-2xl overflow-hidden"
      style={{
        aspectRatio: "1.75 / 1",
        background: "#fff",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Left: full-height photo panel ──────────────── */}
      <div
        className="relative flex flex-col justify-end shrink-0"
        style={{
          width: "40%",
          background: "linear-gradient(145deg, #4f46e5 0%, #7c3aed 60%, #6d28d9 100%)",
          overflow: "hidden",
        }}
      >
        {/* Radial highlight for depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 60% 20%, rgba(167,139,250,0.35) 0%, transparent 60%)",
          }}
        />

        {/* Photo or avatar */}
        {data.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.photoUrl}
            alt={data.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="rounded-full flex items-center justify-center font-black text-white"
              style={{
                width: "52%", aspectRatio: "1/1",
                background: "rgba(255,255,255,0.15)",
                border: "2px solid rgba(255,255,255,0.3)",
                fontSize: "clamp(18px, 4.5vw, 30px)",
              }}
            >
              {data.initials ?? (data.name ?? "").split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
          </div>
        )}

        {/* Gradient overlay at bottom — name sits on top of it */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: "50%", background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)" }}
        />

        {/* Name + title over photo */}
        <div className="relative px-3.5 pb-3">
          <h2
            className="font-extrabold text-white leading-tight"
            style={{ fontSize: "clamp(12px, 2.8vw, 18px)", textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
          >
            {data.name}
          </h2>
          <p
            style={{ fontSize: 8, color: "rgba(221,214,254,0.9)", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 2 }}
          >
            {data.title}
          </p>
        </div>
      </div>

      {/* ── Right: info panel ──────────────────────────── */}
      <div
        className="flex-1 flex flex-col justify-between"
        style={{ padding: "15px 17px 13px", borderLeft: "1px solid #f0ebff" }}
      >
        {/* Company header */}
        <div>
          <div className="flex items-center gap-2 mb-1.5 min-w-0">
            {data.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.logoUrl} alt="logo" className="w-9 h-9 rounded-md object-contain shrink-0" />
            )}
            <p className="font-extrabold text-gray-900 truncate" style={{ fontSize: 13.5 }}>
              {data.company}
            </p>
          </div>
          <div className="w-10 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, ${ACCENT}, #a78bfa)` }} />
        </div>

        {/* Contact rows */}
        <div className="flex flex-col gap-[7px]">
          {cardPhones(data).map((p, i) => (
            <div key={`ph${i}`} className="flex items-center gap-2" style={{ color: "#1e1b4b" }}>
              <span style={{ color: ACCENT }}><IcoPhone /></span>
              <span className="font-bold" style={{ fontSize: 13 }}>
                {formatPhone(p.number)}
                {p.label && <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 5, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.label}</span>}
              </span>
            </div>
          ))}
          {cardFax(data) && (
            <div className="flex items-center gap-2" style={{ color: "#1e1b4b" }}>
              <span style={{ color: ACCENT }}><IcoPhone /></span>
              <span className="font-bold" style={{ fontSize: 13 }}>
                {formatPhone(cardFax(data))}
                <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 5, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fax</span>
              </span>
            </div>
          )}
          {data.email && (
            <div className="flex items-center gap-2 min-w-0" style={{ color: "#374151" }}>
              <span style={{ color: ACCENT }}><IcoMail /></span>
              <span className="truncate" style={{ fontSize: 12 }}>{data.email}</span>
            </div>
          )}
          {data.website && (
            <div className="flex items-center gap-2 min-w-0" style={{ color: "#374151" }}>
              <span style={{ color: ACCENT }}><IcoGlobe /></span>
              <span className="truncate font-medium" style={{ fontSize: 12 }}>{data.website}</span>
            </div>
          )}
          {data.address && (
            <div className="flex items-start gap-2" style={{ color: "#4b5563" }}>
              <span style={{ color: ACCENT, marginTop: 1 }}><IcoPin /></span>
              <span style={{ fontSize: 10.5, lineHeight: 1.25, whiteSpace: "pre-line" }}>{data.address}</span>
            </div>
          )}
          {socials.length > 0 && (
            <div className="flex items-center gap-2.5 mt-0.5">
              {socials.map((s, i) => <span key={i} style={{ color: s.color }}>{s.icon}</span>)}
            </div>
          )}
        </div>

        {/* QR + scan label */}
        <div className="flex items-end justify-end">
          <div className="flex flex-col items-end gap-1">
            <QR size={76} bg="#f5f0ff" fg={ACCENT} />
          </div>
        </div>
      </div>
    </div>
  );
}
