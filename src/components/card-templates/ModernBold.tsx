// ModernBold — Electric Dark
// Style: Near-black full-bleed background, massive name, electric blue accents
// Includes: Name (hero), title, company, phone, email, website, social, QR
// Best for: Tech, agencies, startups, creatives, personal brands

import React from "react";
import { MiniQR as QR } from "./types";
import type { CardData } from "./types";
import { cardAspect, ContactRows, fitFactor, fitPx, qrSize, IcoLinkedIn, IcoInsta, IcoX, IcoTikTok } from "./shared";

const BG           = "#070d1c";
const BLUE_DEFAULT = "#3b82f6";
const DIM          = "#1e3a5f";

export default function ModernBold({ data }: { data: CardData }) {
  const BLUE = data.customization?.accentColor ?? BLUE_DEFAULT;
  const f = fitFactor(data); // auto-fit: more info → everything sizes down together
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
        aspectRatio: cardAspect(data),
        background: BG,
        boxShadow: "0 4px 20px rgba(0,0,0,0.40), 0 1px 3px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04)",
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
        <div className="flex items-center gap-2 min-w-0">
          {data.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt="logo" className="w-8 h-8 rounded-md object-contain shrink-0" />
          )}
          <p
            className="min-w-0 leading-tight"
            style={{ fontSize: fitPx(12, data.company, 18), letterSpacing: "0.16em", color: "#cbd5e1", fontWeight: 700, textTransform: "uppercase", overflowWrap: "anywhere" }}
          >
            {data.company}
          </p>
        </div>

        {/* Name — the hero */}
        <div>
          <div className="w-5 h-[2px] mb-2" style={{ background: BLUE }} />
          <h2
            className="font-black text-white leading-tight"
            style={{ fontSize: fitPx(28, data.name, 15), lineHeight: 1.08, letterSpacing: "-0.01em" }}
          >
            {data.name}
          </h2>
          <p
            style={{ fontSize: 9.5, color: BLUE, letterSpacing: "0.18em", fontWeight: 700, marginTop: 6, textTransform: "uppercase" }}
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
        {/* Contact rows — shared block, auto-fits to the amount of info */}
        <div className="mt-1">
          <ContactRows data={data} f={f} palette={{ accent: BLUE, strong: "#f1f5f9", mid: "#e2e8f0", soft: "#94a3b8", muted: "#94a3b8" }} />
        </div>

        {/* QR + label — always on the card; gives up a little room when dense */}
        <div className="flex items-end justify-end">
          <div className="flex flex-col items-end gap-1">
            <QR size={qrSize(f)} bg={DIM} fg={BLUE} />
          </div>
        </div>
      </div>
    </div>
  );
}
