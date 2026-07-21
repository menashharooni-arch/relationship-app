import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import NativeHidden from "@/components/NativeHidden";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export const metadata: Metadata = {
  title: "Company — SwiftCard",
  description:
    "SwiftCard is a digital business card and link-in-bio platform operated by Swift Card Inc. Company information, leadership, and legal policies.",
};

// Organization structured data for THIS page (the root layout also carries the
// site-wide copy). Public business facts only — no EIN, no private records.
const COMPANY_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "SwiftCard",
  legalName: "Swift Card Inc",
  url: APP_URL,
  logo: `${APP_URL}/brand-icon.png`,
  description:
    "SwiftCard is a digital business card and link-in-bio platform operated by Swift Card Inc.",
  founder: { "@type": "Person", name: "Menash Harooni", jobTitle: "Founder & Authorized Representative" },
  email: "hello@swiftcard.me",
  foundingLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: "New York", addressRegion: "NY", addressCountry: "US" } },
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "hello@swiftcard.me", url: `${APP_URL}/contact` },
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-slate-900 mt-10 mb-3">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-600 text-[15px] leading-relaxed mb-3">{children}</p>;
}

export default function CompanyPage() {
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(COMPANY_JSONLD).replace(/</g, "\\u003c") }}
      />
      <SiteNav />

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-14 w-full">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Company</h1>
        <p className="text-slate-500 text-sm mb-8">Who&apos;s behind SwiftCard</p>

        <P>
          SwiftCard is a digital business card and link-in-bio platform operated by{" "}
          <strong>Swift Card Inc</strong>. Build your card once and share it by tap, QR code, Apple
          Wallet, or link — with built-in lead capture, a link-in-bio page, and automatic follow-up,
          so the people you meet actually stay in touch.
        </P>
        <P>
          <strong>Menash Harooni</strong> is the Founder and Authorized Representative of Swift Card Inc.
        </P>

        {/* Company facts — mirrors the Terms "Company information" block */}
        <dl className="mt-6 mb-3 rounded-xl border border-slate-200 bg-white/60 divide-y divide-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-slate-500 text-[13px] font-semibold sm:w-44 shrink-0">Brand</dt>
            <dd className="text-slate-800 text-[15px]">SwiftCard</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-slate-500 text-[13px] font-semibold sm:w-44 shrink-0">Legal name</dt>
            <dd className="text-slate-800 text-[15px]">Swift Card Inc</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-slate-500 text-[13px] font-semibold sm:w-44 shrink-0">Entity type</dt>
            <dd className="text-slate-800 text-[15px]">Corporation</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-slate-500 text-[13px] font-semibold sm:w-44 shrink-0">Founder &amp; Authorized Representative</dt>
            <dd className="text-slate-800 text-[15px]">Menash Harooni</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-slate-500 text-[13px] font-semibold sm:w-44 shrink-0">Website</dt>
            <dd className="text-slate-800 text-[15px]">
              <Link href="/" className="text-brand underline">swiftcard.me</Link>
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-slate-500 text-[13px] font-semibold sm:w-44 shrink-0">Contact</dt>
            <dd className="text-slate-800 text-[15px]">
              <a href="mailto:hello@swiftcard.me" className="text-brand underline">hello@swiftcard.me</a>
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-slate-500 text-[13px] font-semibold sm:w-44 shrink-0">Location</dt>
            <dd className="text-slate-800 text-[15px]">New York, NY, USA</dd>
          </div>
        </dl>

        <H2>What SwiftCard does</H2>
        <P>
          A SwiftCard is a digital business card that lives at your own link. Share it in person with
          a tap or QR code, drop it in a text or email signature, or add it to Apple Wallet. When
          someone you meet shares their info back, SwiftCard saves them to your contact list and can
          send the follow-up for you — so no connection slips through the cracks. Teams run uniform,
          company-branded cards for every employee from one office dashboard.
        </P>

        <H2>Policies &amp; legal</H2>
        <ul className="mb-3">
          <li className="text-slate-600 text-[15px] leading-relaxed mb-1.5 ml-5 list-disc">
            <Link href="/privacy" className="text-brand underline">Privacy Policy</Link> — what we collect, how we use it, and your rights.
          </li>
          <li className="text-slate-600 text-[15px] leading-relaxed mb-1.5 ml-5 list-disc">
            <Link href="/terms" className="text-brand underline">Terms of Service</Link> — the agreement covering your use of SwiftCard.
          </li>
          <li className="text-slate-600 text-[15px] leading-relaxed mb-1.5 ml-5 list-disc">
            <Link href="/sms-terms" className="text-brand underline">SMS &amp; Messaging Terms</Link> — how text messaging works on SwiftCard, consent, and opt-out.
          </li>
          <li className="text-slate-600 text-[15px] leading-relaxed mb-1.5 ml-5 list-disc">
            <Link href="/sms-consent" className="text-brand underline">SMS Consent Overview</Link> — how people opt in to receive texts, shown step by step.
          </li>
        </ul>

        <H2>Get in touch</H2>
        <P>
          For support, partnerships, or verification questions, email{" "}
          <a href="mailto:hello@swiftcard.me" className="text-brand underline">hello@swiftcard.me</a>{" "}
          or use the <Link href="/contact" className="text-brand underline">contact page</Link>.
        </P>
      </div>

      <footer className="border-t border-warm-border py-10 px-6 bg-cream mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <SwiftCardLogo size={24} />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <NativeHidden><Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link></NativeHidden>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact Us</Link>
          </div>
          <p className="text-slate-400 text-xs">SwiftCard is operated by Swift Card Inc · New York, NY</p>
        </div>
      </footer>
    </main>
  );
}
