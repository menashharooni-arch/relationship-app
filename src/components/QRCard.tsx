"use client";

import { QRCodeSVG } from "qrcode.react";
import { KontactIcon } from "@/components/KontactLogo";

export default function QRCard({ url }: { url: string }) {
  return (
    <div className="relative w-full max-w-sm bg-[#0d1b3e] rounded-3xl overflow-hidden shadow-2xl px-8 py-10 flex flex-col items-center">

      {/* Dot texture top-right */}
      <div
        className="absolute top-0 right-0 w-40 h-40 opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle, #60a5fa 1px, transparent 1px)",
          backgroundSize: "12px 12px",
        }}
      />

      {/* Kontact icon */}
      <div className="mb-8 z-10">
        <KontactIcon size={52} />
      </div>

      {/* QR code */}
      <div className="bg-white rounded-3xl p-5 shadow-xl z-10">
        <QRCodeSVG
          value={url}
          size={180}
          bgColor="#ffffff"
          fgColor="#0d1b3e"
          level="M"
        />
      </div>

      {/* Scan text */}
      <p className="text-white text-xl font-bold mt-6 z-10">Scan to connect</p>
      <p
        className="text-sm mt-1 z-10"
        style={{
          background: "linear-gradient(to right, #60a5fa, #a78bfa)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {url.replace("https://", "")}
      </p>

      {/* Wave decoration */}
      <div className="absolute bottom-0 left-0 w-full">
        <svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <defs>
            <linearGradient id="wave-dark" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          <path d="M0,60 C80,20 160,80 240,50 C300,30 360,70 400,40 L400,100 L0,100 Z"
            fill="url(#wave-dark)" />
        </svg>
      </div>
    </div>
  );
}
