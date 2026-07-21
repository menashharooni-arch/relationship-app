import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import NativeAppBridge from "@/components/NativeAppBridge";
import GuidedTour from "@/components/GuidedTour";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import SiteAnalytics from "@/components/SiteAnalytics";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Organization structured data (schema.org). Feeds Google's brand knowledge
// panel with the correct name, logo, operator, and founder — the highest-impact
// Google Search signal for a SaaS. Only verifiable facts; no invented profiles.
const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "SwiftCard",
  legalName: "Swift Card Inc",
  url: APP_URL,
  logo: `${APP_URL}/brand-icon.png`,
  description:
    "SwiftCard is a digital business card that shares itself — build your card once and share it by tap, QR code, Apple Wallet, or link, with built-in lead capture and automatic follow-up.",
  founder: { "@type": "Person", name: "Menash Harooni", jobTitle: "Founder & Authorized Representative" },
  email: "hello@swiftcard.me",
  foundingLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: "New York", addressRegion: "NY", addressCountry: "US" } },
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "hello@swiftcard.me", url: `${APP_URL}/contact` },
};

const SITE_TITLE = "SwiftCard — The digital business card that shares itself";
const SITE_DESC =
  "Build your SwiftCard once and share it by tap, QR code, Apple Wallet, or link — with built-in lead capture and automatic follow-up.";

export const metadata: Metadata = {
  // Required so file-based opengraph-image URLs resolve to ABSOLUTE links on the
  // production domain — otherwise share previews (iMessage, WhatsApp, social)
  // can point at the wrong host (or localhost) and fail to render the card.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me"),
  // Plain string: untitled pages (homepage/marketing) use this; pages that set
  // their own title override it (they already include "— SwiftCard"). No
  // template — appending one would double the brand ("… SwiftCard · SwiftCard").
  title: SITE_TITLE,
  description: SITE_DESC,
  applicationName: "SwiftCard",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SwiftCard",
  },
  // Site-wide link-preview card (the per-card pages override this with their own
  // dynamic opengraph-image). The root src/app/opengraph-image.tsx supplies the
  // image for the homepage and all marketing pages.
  openGraph: {
    type: "website",
    siteName: "SwiftCard",
    url: APP_URL,
    title: SITE_TITLE,
    description: SITE_DESC,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESC,
  },
};

export const viewport: Viewport = {
  themeColor: "#030712",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the inline script below mutates <html> (adds
    // .sc-js + the saved theme attr) BEFORE React hydrates — expected mismatch.
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {/* Apply the saved app theme before paint (no dark→light flash), and
            mark that JS is running so scroll-reveals only hide when they can be
            un-hidden — with JS off, content stays fully visible. next/script
            beforeInteractive keeps the raw <script> out of the React tree
            (a literal <script> logs console errors on every client render). */}
        <Script
          id="sc-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.classList.add('sc-js');if(localStorage.getItem('sc_theme')==='light')document.documentElement.setAttribute('data-sc-theme','light')}catch(e){}",
          }}
        />
        {/* Brand structured data for Google Search (JSON-LD). Server-rendered
            static markup — safe as a raw <script> in a Server Component. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
        />
        <ServiceWorkerRegistrar />
        {/* Capacitor shell only (no-op on web): universal-link → webview navigation. */}
        <NativeAppBridge />
        <AnalyticsProvider />
        <SiteAnalytics />
        {children}
        <GuidedTour />
      </body>
    </html>
  );
}
