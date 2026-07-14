import { ImageResponse } from "next/og";

// Site-wide link-preview image (1200×630) for the homepage and every marketing
// page — before this, sharing swiftcard.me unfurled with no image. Per-card
// pages keep their own dynamic card/[username]/opengraph-image. Typographic and
// self-contained (no asset fetch) so it renders reliably at the edge.
export const runtime = "edge";
export const alt = "SwiftCard — The digital business card that shares itself";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0b1022 0%, #030712 60%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 48 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 20,
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 52,
              fontWeight: 800,
            }}
          >
            S
          </div>
          <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: -1 }}>SwiftCard</div>
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 940 }}>
          The digital business card that shares itself.
        </div>
        <div style={{ fontSize: 30, color: "#94a3b8", marginTop: 32, maxWidth: 900 }}>
          Tap, QR, Apple Wallet, or link — with built-in lead capture and automatic follow-up.
        </div>
        <div style={{ fontSize: 26, color: "#60a5fa", marginTop: 40, fontWeight: 600 }}>swiftcard.me</div>
      </div>
    ),
    { ...size }
  );
}
