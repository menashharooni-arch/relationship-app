import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import NativeAppBridge from "@/components/NativeAppBridge";
import GuidedTour from "@/components/GuidedTour";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import SiteAnalytics from "@/components/SiteAnalytics";
import ClientErrorReporter from "@/components/ClientErrorReporter";

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
            (a literal <script> logs console errors on every client render).

            This also decides, BEFORE FIRST PAINT, whether we are the native
            shell — and it has to happen here rather than in React. Two reasons:
              • `html.native-app` scopes the entire native design layer in
                globals.css. Added from an effect (as NativeAppBridge does) the
                shell paints one frame of website chrome first, which is exactly
                the "wrapped web page" tell.
              • The shell's start URL is "/", which renders the MARKETING
                homepage — hero, signup CTA, footer link columns. That must
                never be a screen in the app: it is the wrong first impression,
                and App Review guideline 4.2 rejects apps that are primarily a
                repackaged website. Redirecting from a React effect would still
                flash the hero; redirecting here means it is never painted.
            Capacitor injects window.Capacitor via a document-start user script,
            so it is already present by the time this runs. NativeAppBridge
            re-adds the class on mount as a belt-and-braces fallback. */}
        <Script
          id="sc-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.classList.add('sc-js');" +
              "if(localStorage.getItem('sc_theme')==='light')document.documentElement.setAttribute('data-sc-theme','light');" +
              "var C=window.Capacitor;" +
              "if(C&&(C.isNativePlatform?C.isNativePlatform():C.isNative)){" +
              "document.documentElement.classList.add('native-app');" +
              "if(location.pathname==='/')location.replace('/dashboard');" +
              "}}catch(e){}",
          }}
        />
        {/* Brand structured data for Google Search (JSON-LD). ORG_JSONLD is a
            static literal today, so this is safe as-is — but `<` is escaped
            anyway, matching /company. Inside a <script> block the sequence
            "</script>" in ANY string value closes the tag early and everything
            after it parses as markup, so the escape is what keeps this safe on
            the day someone interpolates a card name or company here. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD).replace(/</g, "\\u003c") }}
        />
        <ServiceWorkerRegistrar />
        {/* Reports uncaught browser errors / promise rejections to the team. */}
        <ClientErrorReporter />
        {/* Capacitor shell only (no-op on web): universal-link → webview navigation. */}
        <NativeAppBridge />
        <AnalyticsProvider />
        <SiteAnalytics />
        {/* ── Vercel Web Analytics + Speed Insights (monitoring only) ────────
            Loaded as plain scripts rather than via @vercel/analytics and
            @vercel/speed-insights. Those packages are thin wrappers that inject
            exactly these two URLs, and both declare an OPTIONAL peer on
            @sveltejs/kit which npm speculatively resolves — dragging in a Vite 8
            requirement that collides with Vitest's Vite 7 and leaves a lockfile
            `npm ci` rejects. Two script tags get the identical result with no
            dependency and no lockfile risk, which is the same reasoning
            lib/report-error.ts already documents for staying SDK-free.

            Vercel serves both paths from its own edge for this project once the
            features are enabled in the dashboard — nothing to host. Production
            only: on localhost and preview they'd 404, and preview traffic is us.

            afterInteractive so measurement never competes with first paint. */}
        {/* SPEED INSIGHTS ONLY — the Web Analytics tag is deliberately absent.
            Vercel serves /_vercel/<feature>/script.js only once that feature is
            enabled in the dashboard. Speed Insights is on and returns 200. Web
            Analytics is NOT, so its tag 404'd on every production page load for
            every visitor, and logged a MIME-type console error on top ("Refused
            to execute script … 'text/html'"). Shipping a guaranteed 404 to
            everyone to hold a slot for a feature nobody turned on is a bad trade.

            To turn Web Analytics on: enable it in Vercel → Analytics, then add
            <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
            back here. Nothing else is required — see MONITORING.md. */}
        {process.env.NEXT_PUBLIC_VERCEL_ENV === "production" && (
          <Script src="/_vercel/speed-insights/script.js" strategy="afterInteractive" />
        )}
        {children}
        {/* pausePathPrefix: this instance lives in the ROOT layout, so it is
            alive inside /office/admin too — where AdminGuidedTour is the tour
            that belongs. Without pausing, an unfinished dashboard tour pushed
            the visitor straight back to /dashboard the moment they opened Admin,
            which made the console unreachable for a brand-new Office owner. */}
        <GuidedTour pausePathPrefix="/office/admin" />
      </body>
    </html>
  );
}
