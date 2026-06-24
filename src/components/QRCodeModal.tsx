"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function QRCodeModal({ url, firstName }: { url: string; firstName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] mt-2"
        style={{ background: "#FAF7F2", border: "1px solid #E4DDD4", color: "#475569" }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 14h2v2h-2zM18 14h3v2M21 18v3M17 18h2v3M14 18v3" />
        </svg>
        Show QR Code
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl overflow-hidden flex flex-col items-center animate-pop"
            style={{ background: "#0d1b3e" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="w-full flex items-center justify-between px-6 pt-5 pb-2">
              <p className="text-white font-bold text-base">Scan to connect with {firstName}</p>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white text-2xl leading-none transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* QR code */}
            <div className="bg-white rounded-2xl p-5 mx-6 my-4 shadow-xl">
              <QRCodeSVG
                value={url}
                size={220}
                bgColor="#ffffff"
                fgColor="#0d1b3e"
                level="M"
              />
            </div>

            {/* URL */}
            <p
              className="text-sm font-medium pb-6 px-6 text-center"
              style={{
                background: "linear-gradient(to right, #60a5fa, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {url.replace("https://", "")}
            </p>
          </div>

          {/* Tap to close hint */}
          <p className="absolute bottom-8 text-slate-500 text-xs">Tap outside to close</p>
        </div>
      )}

      <style>{`
        @keyframes pop {
          from { transform: scale(0.88); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        .animate-pop { animation: pop 0.2s cubic-bezier(0.34,1.56,0.64,1); }
      `}</style>
    </>
  );
}
