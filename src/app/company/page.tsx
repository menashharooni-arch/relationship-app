import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooterMini from "@/components/site/SiteFooterMini";

export const metadata: Metadata = {
  title: "Company — SwiftCard",
  description:
    "SwiftCard is a digital business card and link-in-bio platform operated by Swift Card Inc. Company information, leadership, and legal policies.",
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-slate-900 mt-10 mb-3">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-600 text-[0.9375rem] leading-relaxed mb-3">{children}</p>;
}

export default function CompanyPage() {
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      {/* No Organization JSON-LD here: the root layout emits it (lib/brand.ts)
          on every page, this one included. This page used to carry a SECOND,
          slightly different Organization node — two conflicting descriptions of
          one company on the same URL is what makes Google pick neither. */}
      <SiteNav />

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-14 w-full">
        <h1 className="rd-display text-[clamp(1.8rem,3.4vw,2.3rem)] text-slate-900 mb-2 [text-wrap:balance]">Company</h1>
        <p className="text-ink-muted text-sm mb-8">Who&apos;s behind SwiftCard</p>

        <P>
          SwiftCard is a digital business card and link-in-bio platform operated by{" "}
          <strong>Swift Card Inc</strong>. Build your card once and share it by tap, QR code, Apple
          Wallet, or link — with built-in lead capture, a link-in-bio page, and automatic follow-up,
          so the people you meet actually stay in touch.
        </P>
        {/* Company facts — mirrors the Terms "Company information" block */}
        <dl className="mt-6 mb-3 rounded-xl border border-slate-200 bg-white/60 divide-y divide-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-ink-muted text-[0.8125rem] font-semibold sm:w-44 shrink-0">Brand</dt>
            <dd className="text-slate-800 text-[0.9375rem]">SwiftCard</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-ink-muted text-[0.8125rem] font-semibold sm:w-44 shrink-0">Legal name</dt>
            <dd className="text-slate-800 text-[0.9375rem]">Swift Card Inc</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-ink-muted text-[0.8125rem] font-semibold sm:w-44 shrink-0">Entity type</dt>
            <dd className="text-slate-800 text-[0.9375rem]">Corporation</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-ink-muted text-[0.8125rem] font-semibold sm:w-44 shrink-0">Website</dt>
            <dd className="text-slate-800 text-[0.9375rem]">
              <Link href="/" className="text-brand underline">swiftcard.me</Link>
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-ink-muted text-[0.8125rem] font-semibold sm:w-44 shrink-0">Contact</dt>
            <dd className="text-slate-800 text-[0.9375rem]">
              <a href="mailto:hello@swiftcard.me" className="text-brand underline">hello@swiftcard.me</a>
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-ink-muted text-[0.8125rem] font-semibold sm:w-44 shrink-0">Location</dt>
            <dd className="text-slate-800 text-[0.9375rem]">New York, NY, USA</dd>
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
          <li className="text-slate-600 text-[0.9375rem] leading-relaxed mb-1.5 ml-5 list-disc">
            <Link href="/privacy" className="text-brand underline">Privacy Policy</Link> — what we collect, how we use it, and your rights.
          </li>
          <li className="text-slate-600 text-[0.9375rem] leading-relaxed mb-1.5 ml-5 list-disc">
            <Link href="/terms" className="text-brand underline">Terms of Service</Link> — the agreement covering your use of SwiftCard.
          </li>
          <li className="text-slate-600 text-[0.9375rem] leading-relaxed mb-1.5 ml-5 list-disc">
            <Link href="/sms-terms" className="text-brand underline">SMS &amp; Messaging Terms</Link> — how text messaging works on SwiftCard, consent, and opt-out.
          </li>
          <li className="text-slate-600 text-[0.9375rem] leading-relaxed mb-1.5 ml-5 list-disc">
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

      <SiteFooterMini />
    </main>
  );
}
