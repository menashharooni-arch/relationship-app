import { MiniQR as QR } from "./types";
import type { CardData } from "./types";

const Phone = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);
const Mail = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
  </svg>
);
const Globe = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
  </svg>
);
const LinkedIn = () => (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);
const Insta = () => (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
);
const XIcon = () => (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);
const TikTok = () => (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.76a8.16 8.16 0 004.77 1.52V6.83a4.85 4.85 0 01-1-.14z"/>
  </svg>
);

export default function ClassicPro({ data }: { data: CardData }) {
  const hasSocial = data.linkedin || data.instagram || data.twitter || data.tiktok;
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl flex"
      style={{
        aspectRatio: "1.75 / 1",
        background: "#ffffff",
        boxShadow: "0 8px 32px rgba(37,99,235,0.10), 0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {/* Bottom accent bar */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 5, background: "linear-gradient(to right, #1d4ed8, #7c3aed)" }}
      />

      {/* Left panel — pale blue tint */}
      <div
        className="w-[40%] flex flex-col justify-between px-6 py-6"
        style={{
          background: "radial-gradient(circle, rgba(37,99,235,0.1) 1px, transparent 1px) 0 0 / 12px 12px, linear-gradient(160deg, #eef4ff 0%, #f5f8ff 100%)",
          borderRight: "1px solid #dbeafe",
        }}
      >
        <div>
          {/* Logo / company initial */}
          <div className="flex items-center gap-2.5 mb-5">
            {data.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.logoUrl}
                alt="Logo"
                className="w-9 h-9 rounded-xl object-contain shrink-0"
                style={{ boxShadow: "0 2px 8px rgba(37,99,235,0.15)" }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-black"
                style={{
                  background: "linear-gradient(135deg, #1e3a6e, #1d4ed8)",
                  color: "#93c5fd",
                  boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                }}
              >
                {(data.company ?? "K")[0]}
              </div>
            )}
            <span className="text-blue-900/70 font-semibold leading-tight" style={{ fontSize: 10 }}>
              {data.company}
            </span>
          </div>

          <div className="w-10 h-[2px] mb-3" style={{ background: "linear-gradient(to right, #1d4ed8, #7c3aed)" }} />
          <h2 className="font-extrabold text-gray-900 leading-tight" style={{ fontSize: "clamp(14px, 3.2vw, 22px)" }}>
            {data.name}
          </h2>
          <p className="font-bold text-blue-600 uppercase mt-1.5" style={{ fontSize: 9, letterSpacing: "0.16em" }}>
            {data.title}
          </p>
        </div>

        {/* Social icons row */}
        {hasSocial && (
          <div className="flex items-center gap-2.5 text-blue-400/70">
            {data.linkedin && <LinkedIn />}
            {data.instagram && <Insta />}
            {data.twitter && <XIcon />}
            {data.tiktok && <TikTok />}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-between px-6 py-5">
        <div className="flex flex-col gap-2">
          {data.phone && (
            <div className="flex items-center gap-2.5">
              <span className="text-blue-400"><Phone /></span>
              <span className="text-gray-700 font-medium" style={{ fontSize: 11 }}>{data.phone}</span>
            </div>
          )}
          {data.email && (
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-blue-400"><Mail /></span>
              <span className="text-gray-700 truncate" style={{ fontSize: 11 }}>{data.email}</span>
            </div>
          )}
          {data.website && (
            <div className="flex items-center gap-2.5">
              <span className="text-blue-400"><Globe /></span>
              <span className="text-gray-700" style={{ fontSize: 11 }}>{data.website}</span>
            </div>
          )}
          {hasSocial && (
            <div className="mt-1.5 pt-1.5 flex flex-col gap-[4px]" style={{ borderTop: "1px solid #e0e8ff" }}>
              {data.instagram && (
                <div className="flex items-center gap-2" style={{ color: "#c13584" }}>
                  <Insta />
                  <span style={{ fontSize: 9.5 }}>{data.instagram}</span>
                </div>
              )}
              {data.twitter && (
                <div className="flex items-center gap-2 text-gray-500">
                  <XIcon />
                  <span style={{ fontSize: 9.5 }}>{data.twitter}</span>
                </div>
              )}
              {data.tiktok && (
                <div className="flex items-center gap-2 text-gray-500">
                  <TikTok />
                  <span style={{ fontSize: 9.5 }}>{data.tiktok}</span>
                </div>
              )}
              {data.linkedin && (
                <div className="flex items-center gap-2" style={{ color: "#0077b5" }}>
                  <LinkedIn />
                  <span style={{ fontSize: 9.5 }}>{data.linkedin}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* QR + card URL */}
        <div className="flex items-end justify-between">
          {data.cardUrl && (
            <span style={{ fontSize: 7.5, color: "#93c5fd", letterSpacing: "0.05em" }}>
              {data.cardUrl}
            </span>
          )}
          <QR size={38} bg="#eef4ff" fg="#1e3a6e" />
        </div>
      </div>
    </div>
  );
}
