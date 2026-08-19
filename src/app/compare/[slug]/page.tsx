import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import ScrollProgress from "@/components/ScrollProgress";
import ScrollReveal from "@/components/ScrollReveal";
import NativeHidden from "@/components/NativeHidden";

// ── Competitor-alternative pages: /compare/<x>-alternative ──────────────────
//
// Growth surface (owner directive 2026-08-19, phase 2). The /compare hub
// answers "how do these stack up"; these pages each own ONE high-intent
// query — "linktree alternative", "popl alternative" — typed by people who
// already want the product and are choosing a brand.
//
// Honesty rules, same as the hub:
//  - Competitor facts come from their public pricing/feature pages as of
//    publish, say so on the page, and stay conservative — a wrong claim about
//    a competitor is both a credibility and a legal problem.
//  - Rows quoting OUR price are wrapped in NativeHidden (App Review 3.1.1:
//    the iOS shell must not show our pricing).
//  - The FAQ copy doubles as FAQPage JSON-LD, one source.
//
// SEO plumbing: slugs live in src/app/sitemap.ts (COMPARE_SLUGS), the hub
// links every page, and each page cross-links its siblings.

type Row = { label: string; swiftcard: string; them: string; pricing?: true };

type Competitor = {
  name: string;
  metaTitle: string;
  metaDesc: string;
  heroSub: string;
  /** The one-paragraph honest positioning: what they're good at, where SwiftCard differs. */
  honest: string;
  rows: Row[];
  switchReasons: { t: string; d: string }[];
  faq: { q: string; a: string }[];
};

const SHARED_ROWS: Row[] = [
  { label: "Starting price", swiftcard: "Free", them: "" }, // `them` filled per competitor
];

void SHARED_ROWS; // rows are authored per competitor below; kept for reference

const COMPETITORS: Record<string, Competitor> = {
  "linktree-alternative": {
    name: "Linktree",
    metaTitle: "Linktree Alternative — Link in Bio + Digital Business Card",
    metaDesc: "SwiftCard is the Linktree alternative that adds a digital business card, contact capture, and automated follow-up to your link-in-bio page. Free to start.",
    heroSub: "Linktree shows your links. SwiftCard shows your links AND captures who's looking — every visitor can save your contact and send you theirs, with follow-up that runs itself.",
    honest: "Linktree is a fine link-in-bio tool — that's the whole product. If all you need is a list of links, it does the job. People switch to SwiftCard when the page needs to WORK: a business card visitors can save to their phone, a form that sends their details back to you, and automatic follow-up — none of which is what Linktree is built for.",
    rows: [
      { label: "Link-in-bio page", swiftcard: "✓ (Swift Links)", them: "✓" },
      { label: "Digital business card (save to contacts)", swiftcard: "✓", them: "✗" },
      { label: "Visitor shares their contact info back", swiftcard: "✓", them: "✗" },
      { label: "Built-in lead CRM (notes, statuses)", swiftcard: "✓", them: "✗" },
      { label: "Automated follow-up (email + text)", swiftcard: "✓", them: "✗" },
      { label: "NFC tap-to-share", swiftcard: "✓", them: "✗" },
      { label: "Starting price", swiftcard: "Free", them: "Free (12% fee on storefront sales)" },
      { label: "Cheapest paid plan", swiftcard: "$4.99/mo", them: "$8/mo (Starter)", pricing: true },
    ],
    switchReasons: [
      { t: "Your bio link becomes a lead machine", d: "Same job Linktree does — links, socials, video tiles — plus a Connect button that puts the visitor's name, phone, and email in your contacts." },
      { t: "You exist in their phone", d: "A Linktree visit ends when they close the tab. A SwiftCard visit can end with your card saved in their contacts." },
      { t: "Follow-up happens without you", d: "New contact → your email and text sequence starts. Linktree has no concept of a contact, let alone following up with one." },
    ],
    faq: [
      { q: "Does SwiftCard have a link-in-bio page like Linktree?", a: "Yes — every card includes a Swift Links page: your photo, bio, social icons, video previews, and custom link tiles, with themes ('Looks') you pick in one tap. It's what you put in your Instagram or TikTok bio." },
      { q: "What does SwiftCard have that Linktree doesn't?", a: "A digital business card visitors save to their phone in one tap, a share-back form that captures their name/phone/email into your contacts, a built-in lead CRM, automated email and text follow-up, and NFC/QR/Apple Wallet sharing." },
      { q: "Can I move my Linktree links over?", a: "Yes — add the same links as tiles on your Swift Links page in the card editor; featured tiles pull preview images automatically. Most people finish in under ten minutes." },
      { q: "Is SwiftCard free like Linktree?", a: "Yes — the card, the links page, QR/link sharing, and contact capture are free. Pro adds unlimited link tiles, video previews, themes, automation, and analytics." },
      { q: "Do my visitors need an app?", a: "No — everything opens in the browser on any phone. Saving your contact and sharing theirs back are both one tap, no installs." },
    ],
  },
  "popl-alternative": {
    name: "Popl",
    metaTitle: "Popl Alternative — Digital Business Card with Built-In Follow-Up",
    metaDesc: "SwiftCard is the Popl alternative with automated email + text follow-up built in — no extra tools. Digital card, NFC, QR, lead capture. Free to start.",
    heroSub: "Popl shares your card. SwiftCard shares your card and then follows up — automated email and text sequences to every captured lead, built in, not bolted on through integrations.",
    honest: "Popl is a solid digital business card with a strong hardware line — if you mainly want branded NFC accessories, they do that well. People switch to SwiftCard for what happens after the tap: a built-in CRM and automated email + text follow-up sequences that Popl expects you to assemble from third-party integrations.",
    rows: [
      { label: "Digital business card", swiftcard: "✓", them: "✓" },
      { label: "NFC tap-to-share", swiftcard: "✓ (works with any blank NFC tag)", them: "✓ (their branded hardware)" },
      { label: "Lead capture (share-back form)", swiftcard: "✓", them: "✓" },
      { label: "Built-in lead CRM (notes, statuses, pipeline)", swiftcard: "✓", them: "Via 3rd-party integrations" },
      { label: "Automated follow-up sequences (email + text)", swiftcard: "✓", them: "✗" },
      { label: "Link-in-bio page included", swiftcard: "✓ (Swift Links)", them: "Limited" },
      { label: "Starting price", swiftcard: "Free", them: "Free" },
      { label: "Cheapest paid plan", swiftcard: "$4.99/mo", them: "$7.99/mo (Pro)", pricing: true },
    ],
    switchReasons: [
      { t: "Follow-up is the product, not a plug-in", d: "Captured a lead at 2pm? Your check-in text goes out on schedule without Zapier, webhooks, or a second subscription." },
      { t: "No hardware required", d: "SwiftCard writes to any blank NFC tag (a few dollars online) — or skips hardware entirely with QR, link, and Apple Wallet." },
      { t: "One plan, everything in it", d: "Card + links page + CRM + automation + analytics in one subscription, instead of a card app plus the tools to make it useful." },
    ],
    faq: [
      { q: "Can I keep using my NFC card or tag?", a: "Yes — SwiftCard writes your card link to any NFC tag, including ones you already own. Tags store the link, so your card keeps working even after you edit it." },
      { q: "What does SwiftCard automate that Popl doesn't?", a: "Follow-up: when a lead shares their info, SwiftCard can send your email and text sequence automatically (opt-in, STOP-compliant). With Popl you'd wire that through third-party tools." },
      { q: "How does pricing compare?", a: "Both start free. SwiftCard Pro is $4.99/month; Popl Pro lists at $7.99/month. Team plans: SwiftCard is $3.99/seat (min 2), Popl $5/user (min 5). Verify current pricing with them — plans change." },
      { q: "Do I need to buy anything to switch?", a: "No — create your card free, and share by QR, link, or Apple Wallet immediately. NFC is optional." },
      { q: "Can my team switch together?", a: "SwiftCard Office gives every teammate an on-brand card with their own leads under one admin dashboard, unlimited seats." },
    ],
  },
  "blinq-alternative": {
    name: "Blinq",
    metaTitle: "Blinq Alternative — Digital Business Card That Follows Up",
    metaDesc: "SwiftCard is the Blinq alternative with a built-in lead CRM and automated email + text follow-up. Card, QR, NFC, link-in-bio — one plan. Free to start.",
    heroSub: "Blinq makes a clean digital card. SwiftCard makes the card, captures the lead, and runs the follow-up — the whole meeting-to-client pipeline in one product.",
    honest: "Blinq is a well-made digital business card with a generous free tier — as a card, it's good. People switch to SwiftCard when they want the card to feed a pipeline: a built-in CRM with notes and statuses, automated email + text sequences to every new contact, and a full link-in-bio page — instead of connecting separate tools for each.",
    rows: [
      { label: "Digital business card", swiftcard: "✓", them: "✓" },
      { label: "Custom card designer", swiftcard: "✓ (Pro, incl. AI copy-my-card)", them: "✓" },
      { label: "NFC tap-to-share", swiftcard: "✓", them: "✓" },
      { label: "Built-in lead CRM (notes, statuses, pipeline)", swiftcard: "✓", them: "Via 3rd-party integrations" },
      { label: "Automated follow-up sequences (email + text)", swiftcard: "✓", them: "✗" },
      { label: "Link-in-bio page included", swiftcard: "✓ (Swift Links)", them: "Limited" },
      { label: "Starting price", swiftcard: "Free", them: "Free" },
      { label: "Cheapest paid plan", swiftcard: "$4.99/mo", them: "~$3–10/mo (Premium, by billing term)", pricing: true },
    ],
    switchReasons: [
      { t: "The card feeds a real pipeline", d: "Every captured contact lands in a built-in CRM with notes, tags, and follow-up status — not a CSV you promise yourself you'll import somewhere." },
      { t: "Follow-up runs itself", d: "Email and text sequences fire automatically for every new lead, opt-in and STOP-compliant, from your name." },
      { t: "A real link-in-bio, included", d: "Swift Links replaces your Linktree too: themes, video tiles, section headers, and per-page design — one subscription fewer." },
    ],
    faq: [
      { q: "Can I recreate my Blinq card design on SwiftCard?", a: "Yes — pick from designer templates and customize colors, fonts, photo, and logo. Pro users can even upload a picture of any card design (including a physical card) and SwiftCard's AI rebuilds it with your details." },
      { q: "What does SwiftCard do after someone saves my card?", a: "They can share their info back; it lands in your built-in CRM tagged with time and source, and your automated email/text follow-up starts — that whole after-the-tap layer is the difference." },
      { q: "How does pricing compare?", a: "Both start free. SwiftCard Pro is $4.99/month flat; Blinq Premium ranges roughly $3–10/month depending on billing term. Verify current pricing with them — plans change." },
      { q: "Does SwiftCard work without an app for the other person?", a: "Yes — your card opens in any browser; saving your contact and sharing theirs back are one tap, no installs." },
      { q: "Is there a team version?", a: "SwiftCard Office: on-brand cards for every teammate, individual lead books, one admin dashboard — $3.99/seat/month with a 2-seat minimum, unlimited seats." },
    ],
  },
  "hihello-alternative": {
    name: "HiHello",
    metaTitle: "HiHello Alternative — Digital Business Card with Automation",
    metaDesc: "SwiftCard is the HiHello alternative that adds automated email + text follow-up and a built-in lead CRM to your digital business card. Free to start.",
    heroSub: "HiHello makes tidy digital cards and email signatures. SwiftCard covers those — and then captures leads into a built-in CRM and follows up automatically.",
    honest: "HiHello does the fundamentals of digital cards well, including email signatures and multiple cards per person. People switch to SwiftCard for the layer HiHello doesn't focus on: built-in lead capture with a CRM, automated email + text follow-up sequences, and a full link-in-bio page — the parts that turn a card into new business.",
    rows: [
      { label: "Digital business card", swiftcard: "✓", them: "✓" },
      { label: "Multiple cards per account", swiftcard: "✓ (Pro)", them: "✓" },
      { label: "Email signature generator", swiftcard: "✓ (Swift Signature)", them: "✓" },
      { label: "Built-in lead CRM (notes, statuses, pipeline)", swiftcard: "✓", them: "Via 3rd-party integrations" },
      { label: "Automated follow-up sequences (email + text)", swiftcard: "✓", them: "✗" },
      { label: "Link-in-bio page included", swiftcard: "✓ (Swift Links)", them: "Limited" },
      { label: "Starting price", swiftcard: "Free", them: "Free" },
      { label: "Cheapest paid plan", swiftcard: "$4.99/mo", them: "$6+/mo (Professional)", pricing: true },
    ],
    switchReasons: [
      { t: "From contact exchange to pipeline", d: "SwiftCard doesn't stop at swapping details — every captured contact gets notes, statuses, and an automated follow-up sequence." },
      { t: "Texting, done compliantly", d: "Follow-up texts are built in with opt-in consent capture and automatic STOP handling — not a separate SMS tool to buy and wire up." },
      { t: "The bio link is included", d: "Swift Links gives you the Instagram/TikTok bio page too — themes, video tiles, and analytics under the same roof." },
    ],
    faq: [
      { q: "Does SwiftCard do email signatures like HiHello?", a: "Yes — Swift Signature turns your card into an email signature for Gmail, Outlook, and Apple Mail: a live image of your card that links to your card page. It's on every plan." },
      { q: "What's the biggest difference from HiHello?", a: "What happens after the exchange: SwiftCard captures leads into a built-in CRM and runs automated email + text follow-up sequences. HiHello focuses on the card and signature; the pipeline layer is where SwiftCard goes further." },
      { q: "Can I have different cards for different roles?", a: "Yes — SwiftCard Pro includes unlimited cards, each with its own URL, design, links page, contacts, and analytics." },
      { q: "How does pricing compare?", a: "Both start free. SwiftCard Pro is $4.99/month; HiHello's paid plans start around $6/month. Verify current pricing with them — plans change." },
      { q: "Do recipients need the app?", a: "No — your card opens in the browser on any phone, and saving your contact is one tap." },
    ],
  },
};

const ALL_SLUGS = Object.keys(COMPETITORS);

export function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = COMPETITORS[slug];
  if (!c) return { title: "SwiftCard" };
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";
  return {
    title: `${c.metaTitle} | SwiftCard`,
    description: c.metaDesc,
    alternates: { canonical: `${APP_URL}/compare/${slug}` },
    openGraph: { title: c.metaTitle, description: c.metaDesc, url: `${APP_URL}/compare/${slug}`, siteName: "SwiftCard" },
  };
}

function Cell({ value, brand }: { value: string; brand?: boolean }) {
  const isCheck = value.startsWith("✓");
  const isCross = value === "✗";
  return (
    <td className={`px-4 py-4 text-sm text-center align-middle ${brand ? "font-semibold" : "text-slate-600"}`} style={brand ? { color: "#1D4ED8" } : undefined}>
      {isCross ? <span className="text-slate-300">✗</span> : isCheck ? (
        <span><span className="text-green-600 text-base">✓</span>{value.length > 1 ? <span className="text-slate-500 text-xs"> {value.slice(1).trim()}</span> : null}</span>
      ) : value}
    </td>
  );
}

export default async function AlternativePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = COMPETITORS[slug];
  if (!c) notFound();

  const src = `alt_${slug.replace(/-/g, "_")}`;
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <ScrollProgress />
      <ScrollReveal />
      <SiteNav />

      {/* Hero */}
      <section className="text-center px-6 pt-28 pb-10">
        <p className="text-[11px] font-bold tracking-[0.25em] text-brand uppercase mb-4">Comparison</p>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Looking for a {c.name} alternative?</h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto mb-2">{c.heroSub}</p>
        <p className="text-slate-400 text-xs max-w-xl mx-auto">
          {c.name} pricing/features sourced from their public pages and subject to change — confirm current details directly with them.
        </p>
        <div className="mt-7">
          <Link href={`/cards/new?src=${src}`} className="btn-cta bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3.5 rounded-full text-sm transition-colors inline-block">
            Try SwiftCard free →
          </Link>
        </div>
      </section>

      {/* Table */}
      <section className="max-w-3xl mx-auto w-full px-6 pb-12">
        <div className="overflow-x-auto rounded-3xl border border-warm-border bg-white shadow-sm">
          <table className="w-full border-collapse min-w-[520px]">
            <thead>
              <tr className="border-b border-warm-border">
                <th className="px-4 py-4 text-left text-sm font-semibold text-slate-900 w-2/5">&nbsp;</th>
                <th className="px-4 py-4 text-sm font-bold text-center" style={{ color: "#1D4ED8" }}>SwiftCard</th>
                <th className="px-4 py-4 text-sm font-semibold text-slate-500 text-center">{c.name}</th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row, i) => {
                const tr = (
                  <tr key={row.label} className={i % 2 === 1 ? "bg-[#FAF7F2]" : ""}>
                    <td className="px-4 py-4 text-sm font-medium text-slate-700">{row.label}</td>
                    <Cell value={row.swiftcard} brand />
                    <Cell value={row.them} />
                  </tr>
                );
                // Rows quoting OUR price are dropped inside the native shell (3.1.1).
                return row.pricing ? <NativeHidden key={row.label}>{tr}</NativeHidden> : tr;
              })}
            </tbody>
          </table>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed max-w-2xl mx-auto text-center mt-8">{c.honest}</p>
      </section>

      {/* Why people switch */}
      <section className="max-w-4xl mx-auto w-full px-6 pb-14">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Why people switch</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {c.switchReasons.map((r) => (
            <div key={r.t} className="rounded-2xl border border-warm-border bg-white p-6 shadow-sm">
              <p className="text-slate-900 font-semibold text-[15px]">{r.t}</p>
              <p className="text-slate-500 text-[13.5px] mt-1.5 leading-relaxed">{r.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ — the JSON-LD above is generated from exactly this list */}
      <section className="max-w-2xl mx-auto w-full px-6 pb-14">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Common questions</h2>
        <div className="flex flex-col gap-3">
          {c.faq.map((f) => (
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
          <Link href={`/cards/new?src=${src}`} className="btn-cta bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3.5 rounded-full text-sm transition-colors inline-block">
            Create your free card →
          </Link>
        </div>
      </section>

      {/* Sibling comparisons — internal links keep these pages crawlable and ranking */}
      <section className="max-w-2xl mx-auto w-full px-6 pb-16 text-center">
        <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-3">More comparisons</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/compare" className="text-[13px] text-slate-500 hover:text-slate-800 rounded-full px-3 py-1.5 bg-white border border-warm-border transition-colors">Full comparison table</Link>
          {ALL_SLUGS.filter((s) => s !== slug).map((s) => (
            <Link key={s} href={`/compare/${s}`} className="text-[13px] text-slate-500 hover:text-slate-800 rounded-full px-3 py-1.5 bg-white border border-warm-border transition-colors">
              {COMPETITORS[s].name} alternative
            </Link>
          ))}
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
