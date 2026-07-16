// LuxuryMinimal — Ivory & Gold
// Style: Cream/ivory background, gold left strip, faded decorative initials, ultra-premium editorial feel
// Includes: Name, title, phone, email, website, QR — stripped back, refined
// Best for: Luxury real estate, wealth management, executives, high-end services, attorneys

import React from "react";
import { MiniQR as QR } from "./MiniQR";
import type { CardData } from "./types";
import { cardAspect, ContactRows, fitFactor, fitPx, heroGrow, logoStyle, qrSize, templateStyle, isDarkBg, infoPaletteFrom } from "./shared";

const GOLD_DEFAULT  = "#b08d57";
const GOLD2_DEFAULT = "#c9a96e";
const IVORY  = "#fafaf6";
const TEXT   = "#1c1612";
const MUTED  = "#8c7b60";

export default function LuxuryMinimal({ data }: { data: CardData }) {
  const style = templateStyle(data);
  const GOLD  = style.accentColor ?? GOLD_DEFAULT;
  const GOLD2 = style.accentColor ?? GOLD2_DEFAULT;
  const bg = style.bgColor ?? IVORY;
  const nameColor = style.textColor ?? TEXT;
  // Info text sits on the card, so on a dark canvas (e.g. Charcoal Luxe) it
  // defaults to a soft light tone; an explicit infoColor overrides it.
  const darkCard = isDarkBg(bg);
  const infoPal = style.infoColor
    ? infoPaletteFrom(style.infoColor)
    : darkCard
      ? { strong: "#f2ead9", mid: "#e7dcc8", soft: "#c9bda6", muted: "#a89a86" }
      : { strong: TEXT, mid: TEXT, soft: MUTED, muted: MUTED };
  const initials = data.initials ?? (data.name ?? "").split(" ").map((n) => n[0]).join("").slice(0, 2);
  const f = fitFactor(data); // auto-fit: more info → everything sizes down together

  return (
    <div
      className="sc-card relative w-full flex rounded-2xl overflow-hidden"
      style={{
        aspectRatio: cardAspect(data),
        background: bg,
        fontFamily: style.fontFamily,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)",
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
        <div className="flex items-center gap-2 min-w-0">
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt="logo" className="rounded" style={logoStyle(f, 32, { maxWidth: data.company ? "48%" : "88%" })} />
          ) : null}
          <p
            className="min-w-0 leading-tight"
            style={{ fontSize: fitPx(10.5, data.company, 18), letterSpacing: "0.22em", color: GOLD, fontWeight: 700, textTransform: "uppercase", overflowWrap: "anywhere" }}
          >
            {data.company}
          </p>
        </div>

        {/* Name — refined, light weight */}
        <div>
          <h2
            className="text-gray-900 leading-tight"
            style={{
              fontSize: fitPx(23 * heroGrow(f), data.name, 17),
              fontWeight: 400,
              letterSpacing: "0.01em",
              color: nameColor,
              lineHeight: 1.18,
            }}
          >
            {data.name}
          </h2>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="h-px flex-1" style={{ maxWidth: 20, background: GOLD }} />
            <p
              style={{ fontSize: 8.5, letterSpacing: "0.2em", color: GOLD, fontWeight: 600, textTransform: "uppercase" }}
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

        {/* Contact rows — shared block, auto-fits; lighter phone weight keeps the refined feel */}
        <ContactRows data={data} f={f} palette={{ accent: GOLD, ...infoPal, phoneWeight: 600 }} />

        {/* QR — always on the card; gives up a little room when dense */}
        <div className="flex flex-col items-end gap-1">
          <QR size={qrSize(f)} bg="#f5f0e8" fg={GOLD} url={data.cardUrl} />
        </div>
      </div>
    </div>
  );
}
