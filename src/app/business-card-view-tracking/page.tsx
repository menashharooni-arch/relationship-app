import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import ScrollProgress from "@/components/ScrollProgress";
import ScrollReveal from "@/components/ScrollReveal";
import NativeHidden from "@/components/NativeHidden";

// ── Tier-1 landing page: "business card that tracks who viewed it" ──────────
// Part of the SEO plan (owner directive 2026-09-01). Every claim below is a
// real, shipped feature — view notifications, traffic sources, card-vs-links
// split, repeat views, viewer locations (Pro). No invented numbers, no
// competitor claims. Pricing language rides inside NativeHidden (3.1.1).

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";
const SRC = "view_tracking_page"; // registered SIGNUP_SOURCE — keeps this page's conversions separable

export const metadata: Metadata = {
  title: "A Business Card That Tracks Who Viewed It | SwiftCard",
  description:
    "SwiftCard tells you when your business card is viewed — instant notifications, traffic sources, repeat visits, and viewer locations. Free to start.",
  alternates: { canonical: `${APP_URL}/business-card-view-tracking` },
  openGraph: {
    title: "A business card that tracks who viewed it",
    description: "Instant view notifications, traffic sources, repeat visits, and viewer locations — built into your digital business card.",
    url: `${APP_URL}/business-card-view-tracking`,
    siteName: "SwiftCard",
  },
};

const FEATURES = [
  { t: "Know the moment it's viewed", d: "A real person opens your card and your phone tells you — so you can follow up while the conversation is still warm, not next Tuesday." },
  { t: "See where views come from", d: "QR scan, NFC tap, shared link, or your Swift Links page — every view carries its source, so you learn which channel actually works for you." },
  { t: "Card views vs. link views, separately", d: "Your dashboard's traffic graph splits SwiftCard views from Swift Links views, so you always know which page is doing the work." },
  { t: "Repeat visits count", d: "Someone coming back to your card is the strongest buying signal there is. SwiftCard shows unique visitors and repeat views side by side." },
  { t: "Viewer locations", d: "See the cities and countries your views come from — useful the day after a conference, or when a card is shared beyond your own network. Included with Pro." },
  { t: "From viewed to captured", d: "Tracking tells you someone looked; the share-back form turns them into a contact — name, phone, and email straight into your built-in CRM." },
];

const FAQ = [
  { q: "Does SwiftCard notify me when someone views my card?", a: "Yes — you get a notification when your card or your Swift Links page is viewed, and repeat visits within a session aren't double-counted, so the numbers stay honest." },
  { q: "Can I see exactly who viewed my business card?", a: "You see when a view happened, where it came from (QR, NFC, link, or your links page), the viewer's general location, and whether they'd visited before. Names appear when the visitor chooses to share their info back through your card's form — that's what turns a view into a contact." },
  { q: "Does view tracking work with paper business cards?", a: "It works with anything that carries your link: a QR code on a printed card, an NFC tag, an email signature, or a plain URL. Each carries its own source, so you can tell them apart." },
  { q: "Is the tracking accurate, or does it count bots?", a: "SwiftCard filters non-human traffic — crawler and datacenter visits don't count as views, and quick repeat opens are folded into one visit." },
  { q: "Is it free?", a: "Creating your card, sharing it, and view notifications are free. Pro adds detailed analytics like viewer locations and full history." },
];

export default function ViewTrackingPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <ScrollProgress />
      <ScrollReveal />
      <SiteNav />

      <section className="text-center px-6 pt-28 pb-10">
        <p className="text-[11px] font-bold tracking-[0.25em] text-brand uppercase mb-4">View tracking</p>
        <h1 className="text-4xl font-bold text-slate-900 mb-4 max-w-2xl mx-auto">A business card that tells you who&apos;s looking</h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          Paper cards disappear into pockets. A SwiftCard reports back — every view, its source, and whether they came back for a second look.
        </p>
        <div className="mt-7">
          <Link href={`/cards/new?src=${SRC}`} className="btn-cta bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3.5 rounded-full text-sm transition-colors inline-block">
            Create your free card →
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto w-full px-6 pb-14">
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-2xl border border-warm-border bg-white p-6 shadow-sm">
              <p className="text-slate-900 font-semibold text-[15px]">{f.t}</p>
              <p className="text-slate-500 text-[13.5px] mt-1.5 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
        <NativeHidden>
          <p className="text-slate-500 text-sm text-center mt-8">
            Free to start. <Link href="/pricing" className="text-brand underline underline-offset-2">Pro</Link> adds viewer locations, full view history, and automated follow-up.
          </p>
        </NativeHidden>
      </section>

      <section className="max-w-2xl mx-auto w-full px-6 pb-14">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Common questions</h2>
        <div className="flex flex-col gap-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-warm-border bg-white px-6 py-5 shadow-sm">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                <span className="text-slate-900 font-semibold text-[15px]">{f.q}</span>
                <span className="text-slate-400 text-xl leading-none transition-transform group-open:rotate-45 shrink-0">+</span>
              </summary>
              <p className="text-slate-500 text-[14px] mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href={`/cards/new?src=${SRC}`} className="btn-cta bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3.5 rounded-full text-sm transition-colors inline-block">
            Start tracking your card →
          </Link>
        </div>
      </section>

      <section className="max-w-2xl mx-auto w-full px-6 pb-16 text-center">
        <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-3">Keep exploring</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/products/analytics" className="text-[13px] text-slate-500 hover:text-slate-800 rounded-full px-3 py-1.5 bg-white border border-warm-border transition-colors">Dashboard &amp; analytics</Link>
          <Link href="/products/lead-capture" className="text-[13px] text-slate-500 hover:text-slate-800 rounded-full px-3 py-1.5 bg-white border border-warm-border transition-colors">Lead capture</Link>
          <Link href="/link-in-bio-with-analytics" className="text-[13px] text-slate-500 hover:text-slate-800 rounded-full px-3 py-1.5 bg-white border border-warm-border transition-colors">Link in bio with analytics</Link>
          <Link href="/compare" className="text-[13px] text-slate-500 hover:text-slate-800 rounded-full px-3 py-1.5 bg-white border border-warm-border transition-colors">Compare alternatives</Link>
          <Link href="/templates" className="text-[13px] text-slate-500 hover:text-slate-800 rounded-full px-3 py-1.5 bg-white border border-warm-border transition-colors">Card designs</Link>
        </div>
      </section>

      <footer className="border-t border-warm-border py-10 px-6 bg-cream mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <SwiftCardLogo size={24} />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <NativeHidden><Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link></NativeHidden>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact Us</Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">Terms</Link>
          </div>
          <p className="text-slate-400 text-xs">© {new Date().getFullYear()} SwiftCard · New York, NY</p>
        </div>
      </footer>
    </main>
  );
}
