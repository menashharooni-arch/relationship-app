import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooterMini from "@/components/site/SiteFooterMini";
import FaqAccordion from "@/components/site/FaqAccordion";
import ScrollProgress from "@/components/ScrollProgress";
import ScrollReveal from "@/components/ScrollReveal";
import NativeHidden from "@/components/NativeHidden";

// ── Tier-1 landing page: "link in bio with analytics" ───────────────────────
// Part of the SEO plan (owner directive 2026-09-01). Every claim is a shipped
// Swift Links feature — page-view analytics with sources, view notifications,
// themes/Looks, video tiles, contact capture. No invented numbers; pricing
// only inside NativeHidden (3.1.1).

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";
const SRC = "link_in_bio_page"; // registered SIGNUP_SOURCE — keeps this page's conversions separable

export const metadata: Metadata = {
  title: "Link in Bio With Analytics — and Lead Capture | SwiftCard",
  description:
    "Swift Links is the link-in-bio page that reports back: view analytics, traffic sources, visit notifications — plus a Connect button that captures your visitors' contact info. Free to start.",
  alternates: { canonical: `${APP_URL}/link-in-bio-with-analytics` },
  openGraph: {
    title: "Link in bio with analytics",
    description: "A link-in-bio page with real analytics — views, sources, notifications — plus built-in contact capture.",
    url: `${APP_URL}/link-in-bio-with-analytics`,
    siteName: "SwiftCard",
  },
};

const FEATURES = [
  { t: "Views you can actually see", d: "Every visit to your Swift Links page is counted and graphed in your dashboard — today, this week, this month — separately from your card's own traffic." },
  { t: "Know where visitors came from", d: "Instagram bio, TikTok, QR code, a shared link — each visit carries its source, so you learn which bio placement earns its spot." },
  { t: "A notification when it matters", d: "Your phone tells you when your page is viewed — and repeat visits are folded into one honest count, not inflated." },
  { t: "Visitors can share their info back", d: "The one thing no plain bio link does: a Connect button that puts the visitor's name, phone, and email into your contacts — with follow-up that runs itself." },
  { t: "Looks, video tiles, headers", d: "One-tap themes, featured tiles that pull link previews automatically, and section headers that keep long lists tidy." },
  { t: "Your card rides along", d: "Every Swift Links page is backed by your digital business card — one tap and your visitor has you saved in their phone." },
];

const FAQ = [
  { q: "Does Swift Links show analytics for my bio link?", a: "Yes — page views are tracked and graphed in your dashboard, split from your card's views, with traffic sources so you can tell Instagram from TikTok from a QR scan. You also get a notification when your page is viewed." },
  { q: "How is this different from Linktree?", a: "The analytics come with capture: visitors don't just tap through your links — they can save your contact and share theirs back, which lands in your built-in CRM. See the full honest comparison at swiftcard.me/compare/linktree-alternative." },
  { q: "Can I style the page?", a: "Yes — pick a Look (theme) in one tap, feature links as large tiles with automatic preview images, add section headers, and match colors and fonts to your brand." },
  { q: "How many links can I add?", a: "The free plan includes your socials plus 2 custom link buttons; Pro removes the cap and adds video previews, headers, and full analytics." },
  { q: "Do my visitors need an app?", a: "No — the page opens in any browser. Saving your contact and sharing theirs back are both one tap, no installs." },
];

export default function LinkInBioPage() {
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
        <p className="rd-eyebrow text-brand mb-4">Swift Links</p>
        <h1 className="rd-display text-[clamp(2.1rem,4.4vw,3rem)] text-slate-900 mb-4 max-w-2xl mx-auto [text-wrap:balance]">The link in bio that reports back</h1>
        <p className="text-ink-muted text-lg max-w-xl mx-auto">
          Most bio links are a dead end — visitors tap through and vanish. Swift Links counts every visit, names its source, and lets visitors leave their contact info on the way.
        </p>
        <div className="mt-7">
          <Link href={`/cards/new?src=${SRC}`} className="rd-btn rd-btn-primary rd-btn-lg">
            Create your page free →
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto w-full px-6 pb-14">
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div key={f.t} className="rd-card-l p-6">
              <p className="text-slate-900 font-semibold text-[0.9375rem]">{f.t}</p>
              <p className="text-ink-muted text-[0.84375rem] mt-1.5 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
        <NativeHidden>
          <p className="text-ink-muted text-sm text-center mt-8">
            Free to start. <Link href="/pricing" className="text-brand underline underline-offset-2">Pro</Link> unlocks unlimited links, video tiles, and full analytics.
          </p>
        </NativeHidden>
      </section>

      <FaqAccordion items={FAQ}>
        <Link href={`/cards/new?src=${SRC}`} className="rd-btn rd-btn-primary rd-btn-lg">
          Get your Swift Links page →
        </Link>
      </FaqAccordion>

      <section className="max-w-2xl mx-auto w-full px-6 pb-16 text-center">
        <p className="rd-eyebrow text-slate-600 mb-3">Keep exploring</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/products/swiftlinks" className="text-[0.8125rem] text-ink-muted hover:text-slate-800 rounded-full px-3 py-1.5 bg-white border border-warm-border transition-colors">Swift Links product tour</Link>
          <Link href="/compare/linktree-alternative" className="text-[0.8125rem] text-ink-muted hover:text-slate-800 rounded-full px-3 py-1.5 bg-white border border-warm-border transition-colors">Linktree alternative</Link>
          <Link href="/business-card-view-tracking" className="text-[0.8125rem] text-ink-muted hover:text-slate-800 rounded-full px-3 py-1.5 bg-white border border-warm-border transition-colors">Card view tracking</Link>
          <Link href="/products/analytics" className="text-[0.8125rem] text-ink-muted hover:text-slate-800 rounded-full px-3 py-1.5 bg-white border border-warm-border transition-colors">Dashboard &amp; analytics</Link>
          <Link href="/templates" className="text-[0.8125rem] text-ink-muted hover:text-slate-800 rounded-full px-3 py-1.5 bg-white border border-warm-border transition-colors">Card designs</Link>
        </div>
      </section>

      <SiteFooterMini />
    </main>
  );
}
