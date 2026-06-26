// LocalBusiness — Warm Amber
// Style: Amber header stripe, warm cream body, phone as hero contact
// Includes: Company logo/monogram, name, phone (prominent), email, website, QR
// Best for: Restaurants, retail, contractors, salons, home services, local shops

import React from "react";
import { MiniQR as QR } from "./types";
import type { CardData } from "./types";
import { formatPhone, cardPhones, cardFax, IcoPhone, IcoMail, IcoGlobe } from "./shared";

const AMBER_DEFAULT  = "#b45309";
const AMBER2_DEFAULT = "#d97706";
const CREAM  = "#fffbf0";
const WARM   = "#92400e";

export default function LocalBusiness({ data }: { data: CardData }) {
  const AMBER  = data.customization?.accentColor ?? AMBER_DEFAULT;
  const AMBER2 = data.customization?.accentColor ?? AMBER2_DEFAULT;
  const initials = data.initials ?? (data.name ?? "").split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <div
      className="relative w-full flex flex-col rounded-2xl overflow-hidden"
      style={{
        aspectRatio: "1.75 / 1",
        background: CREAM,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Amber top stripe ───────────────────────────── */}
      <div
        style={{
          height: "36%",
          background: `linear-gradient(100deg, ${AMBER} 0%, ${AMBER2} 60%, #f59e0b 100%)`,
          position: "relative",
          flexShrink: 0,
        }}
      >
        {/* Subtle diagonal texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 14px)",
          }}
        />

        {/* Top-right: company badge */}
        <div className="absolute top-0 right-0 h-full flex items-center pr-5">
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.logoUrl}
              alt="logo"
              className="rounded-xl object-contain"
              style={{ width: 58, height: 58, background: "rgba(255,255,255,0.15)", padding: 5 }}
            />
          ) : (
            <div
              className="rounded-xl flex items-center justify-center font-black text-amber-800"
              style={{
                width: 58, height: 58,
                background: "rgba(255,255,255,0.92)",
                fontSize: "clamp(18px, 4vw, 24px)",
              }}
            >
              {initials}
            </div>
          )}
        </div>

        {/* Bottom-left name area within stripe */}
        <div className="absolute bottom-0 left-0 px-5 pb-3">
          <h2
            className="font-extrabold text-white leading-tight"
            style={{ fontSize: "clamp(13px, 3vw, 20px)", lineHeight: 1.15, textShadow: "0 1px 4px rgba(0,0,0,0.2)" }}
          >
            {data.name}
          </h2>
          {data.title && (
            <p style={{ fontSize: 8.5, color: "rgba(254,243,199,0.9)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginTop: 2 }}>
              {data.title}
            </p>
          )}
        </div>
      </div>

      {/* ── Cream body ─────────────────────────────────── */}
      <div
        className="flex-1 flex"
        style={{ padding: "10px 18px 12px" }}
      >
        {/* Left: company + contact info */}
        <div className="flex-1 flex flex-col justify-between">
          {/* Company name */}
          <div className="min-w-0">
            <p className="font-black truncate" style={{ fontSize: 13, color: WARM, letterSpacing: "0.02em" }}>
              {data.company}
            </p>
            <div className="w-12 h-[2px] mt-1 rounded-full" style={{ background: `linear-gradient(90deg, ${AMBER2}, #fbbf24)` }} />
          </div>

          {/* Contacts: phone is HERO */}
          <div className="flex flex-col gap-[5px]">
            {cardPhones(data).map((p, i) => (
              <div key={`ph${i}`} className="flex items-center gap-2">
                <span style={{ color: AMBER }}><IcoPhone /></span>
                <span className="font-bold" style={{ fontSize: 15, color: WARM }}>
                  {formatPhone(p.number)}
                  {p.label && <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 5, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.label}</span>}
                </span>
              </div>
            ))}
            {data.email && (
              <div className="flex items-center gap-2 min-w-0">
                <span style={{ color: AMBER }}><IcoMail /></span>
                <span className="truncate font-semibold" style={{ fontSize: 13, color: "#78350f" }}>{data.email}</span>
              </div>
            )}
            {data.website && (
              <div className="flex items-center gap-2 min-w-0">
                <span style={{ color: AMBER }}><IcoGlobe /></span>
                <span className="truncate" style={{ fontSize: 10, color: "#92400e" }}>{data.website}</span>
              </div>
            )}
            {cardFax(data) && (
              <div className="flex items-center gap-2">
                <span style={{ color: AMBER }}><IcoPhone /></span>
                <span style={{ fontSize: 10, color: "#92400e" }}>
                  {formatPhone(cardFax(data))}
                  <span style={{ opacity: 0.6, marginLeft: 5, fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fax</span>
                </span>
              </div>
            )}
          </div>

          {/* Address if set */}
          {data.address && (
            <p style={{ fontSize: 9, color: "#a16207", lineHeight: 1.2, whiteSpace: "pre-line" }}>{data.address}</p>
          )}
        </div>

        {/* Right: QR */}
        <div className="flex flex-col items-end justify-end gap-1 pl-4 shrink-0">
          <QR size={66} bg="#fff8e6" fg={AMBER} />
        </div>
      </div>

      {/* Bottom gold accent bar */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 3, background: `linear-gradient(90deg, ${AMBER}, #f59e0b, ${AMBER2})` }}
      />
    </div>
  );
}
