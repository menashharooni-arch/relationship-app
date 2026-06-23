// ModernBold — Electric Dark
// Style: Near-black full-bleed background, massive name, electric blue accents
// Includes: Name (hero), title, company, phone, email, website, social, QR
// Best for: Tech, agencies, startups, creatives, personal brands

import React from "react";
import { MiniQR as QR } from "./types";
import type { CardData } from "./types";
import { formatPhone, IcoPhone, IcoMail, IcoGlobe, IcoLinkedIn, IcoInsta, IcoX, IcoTikTok } from "./shared";

const BG    = "#070d1c";
const BLUE  = "#3b82f6";
const DIM   = "#1e3a5f";

export default function ModernBold({ data }: { data: CardData }) {
  const socials = [
    data.instagram && { icon: <IcoInsta />,    color: "#a78bfa" },
    data.twitter   && { icon: <IcoX />,        color: "#94a3b8" },
    data.tiktok    && { icon: <IcoTikTok />,   color: "#94a3b8" },
    data.linkedin  && { icon: <IcoLinkedIn />, color: "#60a5fa" },
  ].filter(Boolean) as { icon: React.ReactNode; color: string }[];

  return (
    <div
      className="relative w-full flex rounded-2xl overflow-hidden"
      style={{
        aspectRatio: "1.75 / 1",
        background: BG,
        boxShadow: "0 4px 32px rgba(0,0,0,0.55), 0 1px 6px rgba(59,130,246,0.1)",
      }}
    >
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Blue glow blob top-right */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 120, height: 120,
          top: -30, right: -20,
          background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
        }}
      />

      {/* ── Left content area ──────────────────────────── */}
      <div
        className="relative flex flex-col justify-between"
        style={{ width: "44%", padding: "18px 16px 16px" }}
      >
        {/* Company */}
        <div className="flex items-center gap-2">
          {data.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt="logo" className="w-5 h-5 rounded object-contain shrink-0" />
          )}
          <p
            style={{ fontSize: 8.5, letterSpacing: "0.28em", color: "#475569", fontWeight: 700, textTransform: "uppercase" }}
          >
            {data.company}
          </p>
        </div>

        {/* Name — the hero */}
        <div>
          <div className="w-5 h-[2px] mb-2" style={{ background: BLUE }} />
          <h2
            className="font-black text-white leading-tight"
            style={{ fontSize: "clamp(17px, 4vw, 26px)", lineHeight: 1.1, letterSpacing: "-0.01em" }}
          >
            {data.name}
          </h2>
          <p
            style={{ fontSize: 8.5, color: BLUE, letterSpacing: "0.2em", fontWeight: 700, marginTop: 6, textTransform: "uppercase" }}
          >
            {data.title}
          </p>
        </div>

        {/* Social icons */}
        {socials.length > 0 ? (
          <div className="flex items-center gap-2.5">
            {socials.map((s, i) => (
              <span key={i} style={{ color: s.color }}>{s.icon}</span>
            ))}
          </div>
        ) : <div />}
      </div>

      {/* Vertical divider with glow */}
      <div className="relative flex items-stretch" style={{ width: 1 }}>
        <div
          className="w-full"
          style={{ background: `linear-gradient(to bottom, transparent, ${BLUE}, transparent)`, opacity: 0.4 }}
        />
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at center, ${BLUE}40 0%, transparent 80%)`, width: 12, left: -6 }}
        />
      </div>

      {/* ── Right contact panel ────────────────────────── */}
      <div
        className="flex-1 flex flex-col justify-between"
        style={{ padding: "16px 18px 14px", color: "#94a3b8" }}
      >
        <div className="flex flex-col gap-[8px] mt-1">
          {data.phone && (
            <div className="flex items-center gap-2" style={{ color: "#e2e8f0" }}>
              <span style={{ color: BLUE }}><IcoPhone /></span>
              <span className="font-medium" style={{ fontSize: 11 }}>{formatPhone(data.phone)}</span>
            </div>
          )}
          {data.email && (
            <div className="flex items-center gap-2 min-w-0" style={{ color: "#cbd5e1" }}>
              <span style={{ color: BLUE }}><IcoMail /></span>
              <span className="truncate" style={{ fontSize: 10.5 }}>{data.email}</span>
            </div>
          )}
          {data.website && (
            <div className="flex items-center gap-2" style={{ color: "#cbd5e1" }}>
              <span style={{ color: BLUE }}><IcoGlobe /></span>
              <span style={{ fontSize: 10.5 }}>{data.website}</span>
            </div>
          )}
        </div>

        {/* QR + label */}
        <div className="flex items-end justify-between">
          {data.cardUrl && (
            <span style={{ fontSize: 7.5, color: "#334155", letterSpacing: "0.04em" }}>{data.cardUrl}</span>
          )}
          <div className="flex flex-col items-end gap-1">
            <p style={{ fontSize: 6.5, color: "#334155", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Scan to save contact
            </p>
            <QR size={42} bg={DIM} fg={BLUE} />
          </div>
        </div>
      </div>
    </div>
  );
}
