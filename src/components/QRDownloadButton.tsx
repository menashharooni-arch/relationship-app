"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function QRDownloadButton({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  function download() {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "evercard-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <>
      {/* Hidden high-res canvas for download */}
      <div ref={containerRef} className="hidden">
        <QRCodeCanvas value={url} size={512} level="H" bgColor="#ffffff" fgColor="#0d1b3e" />
      </div>
      <button
        onClick={download}
        className="w-full border border-gray-700 text-gray-300 hover:border-blue-500 hover:text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm text-center"
      >
        Download QR Code (PNG)
      </button>
    </>
  );
}
