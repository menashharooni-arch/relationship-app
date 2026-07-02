import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  // Required so file-based opengraph-image URLs resolve to ABSOLUTE links on the
  // production domain — otherwise share previews (iMessage, WhatsApp, social)
  // can point at the wrong host (or localhost) and fail to render the card.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me"),
  title: "SwiftCard",
  description: "Your digital business card",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SwiftCard",
  },
};

export const viewport: Viewport = {
  themeColor: "#030712",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
