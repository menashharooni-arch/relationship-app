// LuxuryMinimal — Ivory & Gold
// Style: Cream/ivory background, gold left strip, faded decorative initials, ultra-premium editorial feel
// Includes: Name, title, phone, email, website, QR — stripped back, refined
// Best for: Luxury real estate, wealth management, executives, high-end services, attorneys

import React from "react";
import { MiniQR as QR } from "./types";
import type { CardData } from "./types";
import { formatPhone, IcoPhone, IcoMail, IcoGlobe } from "./shared";

const GOLD   = "#b08d57";
const GOLD2  = "#c9a96e";
const IVORY  = "#fafaf6";
const TEXT   = "#1c1612";
const MUTED  = "#8c7b60";

export default function LuxuryMinimal({ data }: { data: CardData }) {
  const initials = data.initials ?? (data.name ?? "").split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <div
      className="relative w-full flex rounded-2xl overflow-hidden"
      style={{
        aspectRatio: "1.75 / 1",
        background: IVORY,
        boxShadow: "0 4px 28px rgba(176,141,87,0.14), 0 1px 4px rgba(0,0,0,0.07)",
      }}
    >
      {/* ── Gold left strip ────────────────────────────── */}
      <div
        style={{
          width: 5,
          background: `linear-gradient(to bottom, ${GOLD2}, ${GOLD}, #8c6c34)`,
          flexShrink: 0,
        }}
      />

      {/* ── Decorative faded initials ──────────────────── */}
      <div
        className="absolute inset-0 flex items-center pointer-events-none select-none"
        style={{ paddingLeft: 22 }}
      >
        <span
          className="font-black"
          style={{
            fontSize: "clamp(55px, 15vw, 100px)",
            color: "rgba(176,141,87,0.07)",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          {initials}
        </span>
      </div>

      {/* ── Left panel: company + name identity ────────── */}
      <div
        className="relative flex flex-col justify-between"
        style={{ width: "44%", padding: "18px 16px 17px 16px" }}
      >
        {/* Company + optional logo */}
        <div className="flex items-center gap-2">
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt="logo" className="w-5 h-5 object-contain shrink-0 rounded" />
          ) : null}
          <p
            style={{ fontSize: 8, letterSpacing: "0.28em", color: GOLD, fontWeight: 700, textTransform: "uppercase" }}
          >
            {data.company}
          </p>
        </div>

        {/* Name — refined, light weight */}
        <div>
          <h2
            className="text-gray-900 leading-tight"
            style={{
              fontSize: "clamp(14px, 3.2vw, 21px)",
              fontWeight: 300,
              letterSpacing: "0.01em",
              color: TEXT,
              lineHeight: 1.2,
            }}
          >
            {data.name}
          </h2>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="h-px flex-1" style={{ maxWidth: 20, background: GOLD }} />
            <p
              style={{ fontSize: 7.5, letterSpacing: "0.22em", color: GOLD, fontWeight: 600, textTransform: "uppercase" }}
            >
              {data.title}
            </p>
          </div>
        </div>

        {/* Subtle bottom detail */}
        <div className="h-px w-10" style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
      </div>

      {/* ── Thin center divider ────────────────────────── */}
      <div
        className="self-stretch"
        style={{ width: 1, margin: "16px 0", background: `linear-gradient(to bottom, transparent, ${GOLD}40, transparent)` }}
      />

      {/* ── Right panel: contact details ───────────────── */}
      <div
        className="flex-1 flex flex-col justify-between"
        style={{ padding: "18px 18px 17px 16px" }}
      >
        {/* Tagline */}
        <p style={{ fontSize: 7.5, letterSpacing: "0.28em", color: MUTED, textTransform: "uppercase" }}>
          — Private Contact —
        </p>

        {/* Contact rows with gold icon accents */}
        <div className="flex flex-col gap-[8px]">
          {data.phone && (
            <div className="flex items-center gap-2">
              <span style={{ color: GOLD }}><IcoPhone /></span>
              <span style={{ fontSize: 11, color: TEXT, fontWeight: 400, letterSpacing: "0.03em" }}>{formatPhone(data.phone)}</span>
            </div>
          )}
          {data.email && (
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ color: GOLD }}><IcoMail /></span>
              <span className="truncate" style={{ fontSize: 10, color: MUTED }}>{data.email}</span>
            </div>
          )}
          {data.website && (
            <div className="flex items-center gap-2">
              <span style={{ color: GOLD }}><IcoGlobe /></span>
              <span style={{ fontSize: 10, color: MUTED }}>{data.website}</span>
            </div>
          )}
        </div>

        {/* QR */}
        <div className="flex flex-col items-end gap-1">
          <p style={{ fontSize: 6, color: GOLD2, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            Scan to save contact
          </p>
          <QR size={40} bg="#f5f0e8" fg={GOLD} />
        </div>
      </div>
    </div>
  );
}
