"use client";

import { useRef, useState } from "react";

interface Props {
  cardRef: React.RefObject<HTMLDivElement | null>;
  filename?: string;
}

export default function DownloadCardButton({ cardRef, filename = "swiftcard.png" }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (!cardRef.current) return;
    setLoading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    } catch {
      // silently fail — user still has other share options
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 w-full justify-center border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-semibold py-2.5 rounded-full transition-colors text-sm disabled:opacity-50"
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      )}
      {loading ? "Saving…" : "Download card as image"}
    </button>
  );
}
