"use client";

import QRCode from "qrcode";
import type { ReactElement } from "react";

// User-supplied photo (iPhone + Apple Watch sharing a contact) with a big
// SwiftCard QR painted onto the Apple Watch screen.
//
// The watch screen sits at an angle, so the QR is an absolutely-placed rounded
// panel in PERCENT units (tracks the responsive image) rotated to sit on the
// screen. These are the ONLY numbers to tweak if it needs nudging:
//   cx/cy = center (% of image), w/h = size (% of image), rot = degrees.
const WATCH_QR = { cx: 67.2, cy: 46.6, w: 9, h: 18, rot: 9 };

const CARD_URL = "https://swiftcard.me/card/demo-realty";

// QR that fills its container (no hooks — matrix computed synchronously).
function FillQR({ url, fg = "#111827" }: { url: string; fg?: string }) {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  let n = 0;
  const rects: ReactElement[] = [];
  try {
    const qr = QRCode.create(target, { errorCorrectionLevel: "M" });
    n = qr.modules.size;
    const cells = qr.modules.data;
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (cells[r * n + c]) {
          let w = 1;
          while (c + w < n && cells[r * n + (c + w)]) w++;
          rects.push(<rect key={`${r}-${c}`} x={c} y={r} width={w} height={1} fill={fg} />);
          c += w;
        } else c++;
      }
    }
  } catch { n = 0; }
  if (!n) return null;
  return (
    <svg viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" style={{ width: "100%", height: "100%", display: "block" }}>
      {rects}
    </svg>
  );
}

export default function WatchShareImage() {
  return (
    <div className="relative w-full max-w-[600px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marketing/watch-share.jpg"
        alt="Share your SwiftCard from your iPhone and Apple Watch"
        width={1298}
        height={648}
        className="w-full h-auto block rounded-2xl"
      />
      {/* Big QR on the Apple Watch screen */}
      <div
        className="absolute bg-white shadow-md"
        style={{
          left: `${WATCH_QR.cx}%`,
          top: `${WATCH_QR.cy}%`,
          width: `${WATCH_QR.w}%`,
          height: `${WATCH_QR.h}%`,
          transform: `translate(-50%, -50%) rotate(${WATCH_QR.rot}deg)`,
          borderRadius: "22%",
          padding: "7%",
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <FillQR url={CARD_URL} fg="#0B1022" />
      </div>
    </div>
  );
}
