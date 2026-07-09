import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import GuidedTour from "@/components/GuidedTour";

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
        <ServiceWorkerRegistrar />
        {children}
        <GuidedTour />
      </body>
    </html>
  );
}
