// ClassicPro — Executive Navy
// Style: Navy branding panel + white info panel
// Includes: Logo, name, title, phone, email, website, social row, QR
// Best for: Finance, consulting, legal, corporate, healthcare

import { MiniQR as QR } from "./types";
import type { CardData } from "./types";
import { formatPhone, IcoPhone, IcoMail, IcoGlobe, IcoPin, IcoLinkedIn, IcoInsta, IcoX, IcoTikTok } from "./shared";

const NAVY = "#0e1b35";
const BLUE_DEFAULT = "#2563eb";

export default function ClassicPro({ data }: { data: CardData }) {
  const BLUE = data.customization?.accentColor ?? BLUE_DEFAULT;
  const socials = [
    data.linkedin  && { icon: <IcoLinkedIn />, handle: data.linkedin, color: "#60a5fa" },
    data.instagram && { icon: <IcoInsta />,    handle: data.instagram, color: "#c084fc" },
    data.twitter   && { icon: <IcoX />,        handle: data.twitter,  color: "#94a3b8" },
    data.tiktok    && { icon: <IcoTikTok />,   handle: data.tiktok,   color: "#94a3b8" },
  ].filter(Boolean) as { icon: React.ReactNode; handle: string; color: string }[];

  return (
    <div
      className="relative w-full flex rounded-2xl overflow-hidden"
      style={{
        aspectRatio: "1.75 / 1",
        background: "#fff",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Left navy branding panel ─────────────────────── */}
      <div
        className="relative flex flex-col justify-between"
        style={{
          width: "40%",
          background: `linear-gradient(160deg, ${NAVY} 0%, #162947 100%)`,
          padding: "18px 16px 16px",
        }}
      >
        {/* Subtle dot texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
        />

        {/* Company logo + name */}
        <div className="relative flex items-center gap-2">
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.logoUrl}
              alt="logo"
              className="rounded-lg object-contain shrink-0"
              style={{ width: 28, height: 28, background: "rgba(255,255,255,0.1)" }}
            />
          ) : (
            <div
              className="rounded-lg flex items-center justify-center shrink-0 font-black"
              style={{
                width: 28, height: 28,
                background: BLUE,
                color: "#bfdbfe",
                fontSize: 12,
              }}
            >
              {(data.company || data.name || "K")[0].toUpperCase()}
            </div>
          )}
          <span
            className="text-white/60 font-semibold truncate leading-tight"
            style={{ fontSize: 9.5, letterSpacing: "0.05em" }}
          >
            {data.company}
          </span>
        </div>

        {/* Name + title — hero */}
        <div className="relative">
          <div className="w-8 h-[2px] mb-2.5 rounded-full" style={{ background: BLUE }} />
          <h2
            className="font-extrabold text-white leading-tight"
            style={{ fontSize: "clamp(15px, 3.5vw, 22px)", lineHeight: 1.15 }}
          >
            {data.name}
          </h2>
          <p
            className="text-blue-300 font-semibold mt-1.5"
            style={{ fontSize: 8.5, letterSpacing: "0.18em", textTransform: "uppercase" }}
          >
            {data.title}
          </p>
        </div>

        {/* Social icons row */}
        {socials.length > 0 && (
          <div className="relative flex items-center gap-2.5">
            {socials.map((s, i) => (
              <span key={i} style={{ color: s.color }} className="opacity-80">{s.icon}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Right info panel ─────────────────────────────── */}
      <div
        className="flex-1 flex flex-col justify-between"
        style={{ padding: "16px 18px 14px", borderLeft: "1px solid #e8eef8" }}
      >
        {/* Contact rows */}
        <div className="flex flex-col gap-[7px] mt-0.5">
          {data.phone && (
            <div className="flex items-center gap-2" style={{ color: NAVY }}>
              <IcoPhone />
              <span className="font-semibold" style={{ fontSize: 11 }}>{formatPhone(data.phone)}</span>
            </div>
          )}
          {data.email && (
            <div className="flex items-center gap-2 min-w-0" style={{ color: "#334155" }}>
              <IcoMail />
              <span className="truncate" style={{ fontSize: 10.5 }}>{data.email}</span>
            </div>
          )}
          {data.website && (
            <div className="flex items-center gap-2" style={{ color: "#334155" }}>
              <IcoGlobe />
              <span style={{ fontSize: 10.5 }}>{data.website}</span>
            </div>
          )}
          {data.address && (
            <div className="flex items-start gap-2" style={{ color: "#475569" }}>
              <span style={{ marginTop: 1 }}><IcoPin /></span>
              <span style={{ fontSize: 9, lineHeight: 1.25, whiteSpace: "pre-line" }}>{data.address}</span>
            </div>
          )}
        </div>

        {/* Social handles (compact, if space) */}
        {socials.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-[4px]">
            {socials.slice(0, 2).map((s, i) => (
              <div key={i} className="flex items-center gap-1.5" style={{ color: "#64748b" }}>
                {s.icon}
                <span style={{ fontSize: 9.5 }}>{s.handle}</span>
              </div>
            ))}
          </div>
        )}

        {/* QR + scan label */}
        <div className="flex items-end justify-end">
          <div className="flex flex-col items-end gap-1">
            <QR size={76} bg="#f0f5ff" fg={NAVY} />
          </div>
        </div>
      </div>

      {/* Bottom gradient accent */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 4, background: `linear-gradient(90deg, ${BLUE}, #7c3aed)` }}
      />
    </div>
  );
}
