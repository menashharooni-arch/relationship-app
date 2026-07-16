import QRCode from "qrcode";
import type { ReactElement } from "react";

// Split out of types.tsx: that module is value-imported (withoutSocials,
// SAMPLE_DATA) by ~30 files including several client homepage components, so
// co-locating the `qrcode` encoder there risked dragging it into bundles that
// never render a QR code at all (performance audit).
export function MiniQR({ size = 52, bg = "#ffffff", fg = "#111827", url }: { size?: number; bg?: string; fg?: string; url?: string }) {
  const p = size * 0.055;
  const raw = (url ?? "").trim();
  const target = raw ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) : "https://swiftcard.me";

  let count = 0;
  const runs: { r: number; c: number; w: number }[] = [];
  try {
    const qr = QRCode.create(target, { errorCorrectionLevel: "M" });
    count = qr.modules.size;
    const cells = qr.modules.data; // Uint8Array, 1 = dark module
    for (let r = 0; r < count; r++) {
      let c = 0;
      while (c < count) {
        if (cells[r * count + c]) {
          let w = 1;
          while (c + w < count && cells[r * count + (c + w)]) w++;
          runs.push({ r, c, w });
          c += w;
        } else {
          c++;
        }
      }
    }
  } catch {
    count = 0;
  }
  const rects: ReactElement[] = runs.map(({ r, c, w }) => (
    <rect key={`${r}-${c}`} x={c} y={r} width={w} height={1} fill={fg} />
  ));

  return (
    <div data-qr="1" style={{ width: size, height: size, background: bg, padding: p, borderRadius: size * 0.1, flexShrink: 0 }}>
      {count > 0 && (
        <svg viewBox={`0 0 ${count} ${count}`} shapeRendering="crispEdges" style={{ width: "100%", height: "100%", display: "block" }}>
          {rects}
        </svg>
      )}
    </div>
  );
}
