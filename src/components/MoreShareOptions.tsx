"use client";

import { useState } from "react";
import QRCard from "@/components/QRCard";
import QRDownloadButton from "@/components/QRDownloadButton";
import CopyButton from "@/components/CopyButton";

export default function MoreShareOptions({ url }: { url: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full py-2.5 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
        Other ways to share
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-semibold text-sm">Share options</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>

            {/* Copy link */}
            <p className="text-gray-500 text-[11px] uppercase tracking-wide mb-1.5">Card link</p>
            <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 mb-5">
              <svg viewBox="0 0 16 16" fill="#3b82f6" className="w-3.5 h-3.5 shrink-0"><path d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8S12.42 0 8 0zm1 11.93V13H7v-1.07A6.003 6.003 0 012.07 7H4v-.5h-.93A6.003 6.003 0 017 1.07V2h2v1.07A6.003 6.003 0 0113.93 6.5H12V7h1.93A6.003 6.003 0 019 11.93z" /></svg>
              <span className="text-blue-400 text-xs truncate flex-1">{url.replace("https://", "")}</span>
              <CopyButton text={url} />
            </div>

            {/* QR code */}
            <p className="text-gray-500 text-[11px] uppercase tracking-wide mb-2">QR code</p>
            <QRCard url={url} />
            <div className="mt-3">
              <QRDownloadButton url={url} compact />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
