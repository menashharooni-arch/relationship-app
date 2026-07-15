"use client";

import { QRCodeSVG } from "qrcode.react";

// A real, scannable QR code for the Swift Links poster on /share. The page
// that renders this is a server component (auth/data fetching), so the actual
// qrcode.react render — which needs the client boundary — lives here.
export default function SwiftLinksQR({ url }: { url: string }) {
  return <QRCodeSVG value={url} size={112} bgColor="#ffffff" fgColor="#17255A" level="M" />;
}
