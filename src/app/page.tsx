import Link from "next/link";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import HeroPhone from "@/components/HeroPhone";
import PreviewClient from "@/app/preview/PreviewClient";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollProgress from "@/components/ScrollProgress";
import MarketingNav from "@/components/MarketingNav";
import CountUpStat from "@/components/CountUpStat";
import StickyMobileCTA from "@/components/StickyMobileCTA";

const HERO_HEADLINE = "The digital business card people save in one tap.";

const STEPS = [
  {
    n: "01",
    title: "Set up your card",
    body: "Add your name, title, contact details, and social links. Your card is live in under a minute.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Share it anywhere",
    body: "Send your link, show your QR code, or tap an NFC card. No app needed on their end.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "Turn contacts into clients",
    body: "Every share becomes a saved lead with full context, and your follow-ups go out automatically — no chasing, no forgetting.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

const FEATURES = [
  {
    title: "Digital business card",
    body: "Your photo, logo, and every way to reach you — saved in one tap.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <rect x="3" y="5" width="18" height="14" rx="2" /><path strokeLinecap="round" d="M3 9.5h18M7 14h5" />
      </svg>
    ),
  },
  {
    title: "Swift Links page",
    body: "A link-in-bio page for your Instagram, TikTok, or other social bios.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
  {
    title: "Swift Signature",
    body: "Your live card in your email signature, always up to date.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    title: "No app required",
    body: "Works in any browser — nothing to download. The app just makes it smoother.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3" />
      </svg>
    ),
  },
  {
    title: "Tap to call, email & visit",
    body: "One tap to call, email, or open your website.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
      </svg>
    ),
  },
  {
    title: "Custom card design",
    body: "Five templates, or design your own with drag-and-drop.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    title: "Built-in CRM",
    body: "Every share becomes a tracked contact — notes, status, and source.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
  {
    title: "AI follow-ups",
    body: "AI writes your follow-ups; new leads get an instant first touch.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
  },
  {
    title: "Analytics",
    body: "Views, top locations, and the sources driving the most saves.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    title: "Unlimited cards",
    body: "A separate card for every role, event, or campaign.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    ),
  },
  {
    title: "CRM integrations",
    body: "Push new leads to Zapier or Google Contacts automatically.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    title: "Share anywhere",
    body: "QR code, link, NFC tap, or the phone's share sheet.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
      </svg>
    ),
  },
];

const TESTIMONIALS = [
  {
    quote: "I handed out 200 paper cards at a conference and got zero follow-ups. With SwiftCard I closed 3 deals from one event. The QR code alone paid for itself.",
    name: "John Chicoine",
    role: "Commercial Real Estate Broker",
    initial: "JC",
    source: "LinkedIn",
  },
  {
    quote: "As a mortgage broker, first impressions are everything. SwiftCard makes me look polished and my clients always comment on how easy it was to save my contact.",
    name: "Aaron Bennett",
    role: "Senior Mortgage Broker",
    initial: "AB",
    source: "App Store",
  },
  {
    quote: "The automated follow-up emails are a game changer. Leads reply days later saying they forgot about me — now they don't. My pipeline has never been this full.",
    name: "Marcus Webb",
    role: "Startup Founder",
    initial: "MW",
    source: "G2",
  },
  {
    quote: "I replaced our entire team's paper cards with SwiftCard in one afternoon. The shared office dashboard lets me see how each rep is performing in real time.",
    name: "Priya Shankar",
    role: "VP of Marketing",
    initial: "PS",
    source: "LinkedIn",
  },
  {
    quote: "I tap my NFC card to someone's phone and they have my full card in seconds. It's genuinely the most impressive thing I do at a client meeting.",
    name: "Derek Fontaine",
    role: "Insurance Agent",
    initial: "DF",
    source: "App Store",
  },
  {
    quote: "The analytics dashboard showed me that 80% of my views came from Instagram. I was able to double down on what was actually working.",
    name: "Stephanie Owens",
    role: "Independent Consultant",
    initial: "SO",
    source: "G2",
  },
];

const FAQS = [
  {
    q: "Does the person I share with need to download anything?",
    a: "No. Your card opens in any browser instantly. They can save your contact to their phone with one tap — no app, no account, no friction.",
  },
  {
    q: "What happens when someone shares their info with me?",
    a: "They land in your built-in CRM instantly — name, email, phone, the message they wrote, even their location and which link they came from. You can mark contacts read/unread, add notes, track the conversation, and let AI draft your follow-up.",
  },
  {
    q: "What is a Swift Links page?",
    a: "Every card comes with its own Swift Links page — a modern link-in-bio with your photo, bio, social icons, video previews, and custom buttons. Share it anywhere you'd drop a link, like your Instagram, TikTok, or other social bios.",
  },
  {
    q: "Can I put my card in my email signature?",
    a: "Yes — copy your live business card straight into your email signature in one click. It includes your card image with tap-to-call, email, and website links, and it always reflects your latest card, so every email you send shares it.",
  },
  {
    q: "Can I use SwiftCard with NFC cards?",
    a: "Yes. Your card URL is NFC-ready out of the box. Buy any blank NFC card or sticker, write your SwiftCard link to it with a free app, and anyone who taps it sees your card instantly.",
  },
  {
    q: "What's the difference between Free and Pro?",
    a: "Free gives you 1 card, 5 new leads a month, all 5 templates, unlimited Swift Links buttons, analytics with top locations, a Day-1 follow-up email, plus 3 AI drafts and 3 card scans a month — plenty to get started. Pro removes the monthly limits (unlimited leads, drafts and scans), adds unlimited cards, the custom card designer, automated email + text follow-up sequences, full who/when/where analytics, CSV export & integrations, and removes the SwiftCard branding from your card.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no commitments. Cancel from your account at any time and you keep access until the end of your billing period.",
  },
];

const SOURCE_BADGE_COLORS: Record<string, string> = {
  LinkedIn: "#0A66C2",
  "App Store": "#007AFF",
  G2: "#FF492C",
};

const SOFTWARE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SwiftCard",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  description: "Digital business card and lead CRM — share your contact info with a tap, capture leads instantly, and follow up automatically.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <ScrollProgress />
      <ScrollReveal />
      <StickyMobileCTA />

      {/* Nav — scroll-aware, animated mobile menu (same links) */}
      <MarketingNav />

      {/* Hero — clear, benefit-first, instantly scannable */}
      <section className="relative max-w-6xl mx-auto w-full px-6 pt-16 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Decorative floating blobs — subtle depth behind the hero */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
          <div className="sc-blob sc-blob-a" style={{ width: 340, height: 340, top: -80, left: -60, background: "radial-gradient(circle, rgba(29,78,216,0.14), transparent 70%)" }} />
          <div className="sc-blob sc-blob-b" style={{ width: 300, height: 300, top: 40, right: -40, background: "radial-gradient(circle, rgba(124,58,237,0.12), transparent 70%)" }} />
        </div>
        <div>
          <div className="sc-rise inline-flex items-center gap-2 border border-warm-border rounded-full px-4 py-1.5 text-xs text-slate-500 mb-8 bg-cream-dark">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Free to start — no credit card required
          </div>

          <h1 className="text-[2.9rem] sm:text-[3.25rem] font-bold text-slate-900 leading-[1.08] tracking-tight mb-5">
            {HERO_HEADLINE.split(" ").map((w, i, arr) => (
              // Wrapper keeps a real, breakable space between words (correct
              // wrapping + text selection + screen readers); the inner span does
              // the word-by-word rise.
              <span key={i}>
                <span className="sc-word" style={{ ["--sc-wd" as string]: `${120 + i * 55}ms` } as React.CSSProperties}>{w}</span>
                {i < arr.length - 1 ? " " : ""}
              </span>
            ))}
          </h1>

          {/* Scannable "what you get" checks — so anyone gets it instantly */}
          <ul className="sc-rise sc-rise-3 space-y-2.5 mb-8 max-w-md">
            {[
              "Share by link, QR code, or NFC tap",
              "They save you in one tap — nothing to download",
              "Every share becomes a lead + automatic follow-up",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 20 20" fill="#1D4ED8" className="w-3 h-3"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.79 6.8-6.79a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                </span>
                <span className="text-slate-700 text-[15px] leading-snug">{t}</span>
              </li>
            ))}
          </ul>

          <div className="sc-rise sc-rise-4 flex flex-col sm:flex-row gap-3">
            <Link
              href="/login?mode=signup"
              className="btn-cta bg-brand hover:bg-brand-dark text-white font-semibold px-7 py-3.5 rounded-full text-sm text-center"
            >
              Create your free card
            </Link>
            <Link
              href="#demo"
              className="btn-cta border border-warm-card-border hover:border-slate-400 text-slate-700 hover:text-slate-900 font-semibold px-7 py-3.5 rounded-full text-sm text-center bg-warm-card"
            >
              See it live →
            </Link>
          </div>

          <div className="sc-rise sc-rise-4 flex items-center gap-4 mt-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} viewBox="0 0 20 20" fill="#d97706" className="w-3 h-3"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                ))}
              </span>
              4.9 / 5 rating
            </span>
            <span className="w-px h-3.5 bg-warm-border" />
            <span>Set up in 30 seconds — no design skills needed</span>
          </div>
        </div>

        {/* Phone mockup */}
        <HeroPhone />
      </section>

      {/* Stats bar — numbers count up as they scroll into view */}
      <div className="border-t border-warm-border bg-cream py-14 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { to: 88, suffix: "%", decimals: 0, label: "of paper cards are tossed within a week — a digital card never is" },
            { to: 70, suffix: "%", decimals: 0, label: "more follow-ups when people can save your contact instantly" },
            { to: 1, suffix: " tap", decimals: 0, label: "to save your card to their phone — no app, no typing" },
          ].map((s, i) => (
            <div key={s.label} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <CountUpStat to={s.to} suffix={s.suffix} decimals={s.decimals} className="text-4xl font-bold text-slate-900 mb-1 tabular-nums" />
              <p className="text-slate-500 text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* What is SwiftCard — the concept, card first, in plain language */}
      <section className="border-t border-warm-border bg-cream-dark py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14" data-reveal>
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">What is SwiftCard?</p>
            <h2 className="text-3xl font-bold text-slate-900">One link. Everything they need to reach you.</h2>
            <p className="text-slate-500 mt-3 max-w-xl mx-auto text-base leading-relaxed">
              It replaces the paper business card — and comes with three parts:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* All three are neutral at rest; hovering any one gives it the blue
                outline + blue highlighted icon + subtle blue tint. */}
            {/* Pillar 1 — the card */}
            <div className="card-premium group bg-warm-card border border-warm-card-border hover:border-brand hover:bg-[#EFF3FF] rounded-2xl p-7 transition-colors" data-reveal>
              <div className="sc-card-icon w-11 h-11 rounded-xl bg-[#E8ECF5] text-brand group-hover:bg-brand group-hover:text-white flex items-center justify-center mb-4 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                  <rect x="3" y="5" width="18" height="14" rx="2" /><path strokeLinecap="round" d="M3 9.5h18M7 14h5" />
                </svg>
              </div>
              <p className="text-slate-900 font-bold text-base mb-1">1. Your SwiftCard</p>
              <p className="text-slate-500 text-sm leading-relaxed">
                The business card itself — your photo, logo, and every way to reach you. One tap saves it to their phone.
              </p>
            </div>

            {/* Pillar 2 — Swift Links */}
            <div className="card-premium group bg-warm-card border border-warm-card-border hover:border-brand hover:bg-[#EFF3FF] rounded-2xl p-7 transition-colors" data-reveal style={{ transitionDelay: "90ms" }}>
              <div className="sc-card-icon w-11 h-11 rounded-xl bg-[#E8ECF5] text-brand group-hover:bg-brand group-hover:text-white flex items-center justify-center mb-4 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </div>
              <p className="text-slate-900 font-bold text-base mb-1">2. Swift Links</p>
              <p className="text-slate-500 text-sm leading-relaxed">
                A link-in-bio page — bio, socials, and buttons at one link. Made for your Instagram, TikTok, or other social bios.
              </p>
            </div>

            {/* Pillar 3 — Swift Signature */}
            <div className="card-premium group bg-warm-card border border-warm-card-border hover:border-brand hover:bg-[#EFF3FF] rounded-2xl p-7 transition-colors" data-reveal style={{ transitionDelay: "180ms" }}>
              <div className="sc-card-icon w-11 h-11 rounded-xl bg-[#E8ECF5] text-brand group-hover:bg-brand group-hover:text-white flex items-center justify-center mb-4 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-slate-900 font-bold text-base mb-1">3. Swift Signature</p>
              <p className="text-slate-500 text-sm leading-relaxed">
                Your live card in your email signature. Add it once; every email you send shares it.
              </p>
            </div>
          </div>

          <p className="text-center text-slate-400 text-sm mt-8">
            See it in action 👇
          </p>
        </div>
      </section>

      {/* Interactive live demo — the real dashboard, embedded */}
      <section id="demo" className="bg-gray-950 py-20 px-4 scroll-mt-16">
        <div className="max-w-5xl mx-auto text-center mb-8" data-reveal>
          <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase mb-3">See it live</p>
          <h2 className="text-3xl font-bold text-white">Try it yourself — this is your dashboard</h2>
          <p className="text-gray-400 mt-3 max-w-lg mx-auto text-sm">
            The real app, loaded with sample data. Click around — it&apos;s exactly what you get.
          </p>
        </div>
        <div data-reveal style={{ transitionDelay: "80ms" }}>
          <PreviewClient embedded />
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-warm-border py-28 px-6 bg-cream-dark">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16" data-reveal>
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">How it works</p>
            <h2 className="text-3xl font-bold text-slate-900">Three steps to your first lead</h2>
            <p className="text-slate-500 mt-3 max-w-md mx-auto text-sm">Set up once, share anywhere, and watch the leads roll in.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 relative">
            {/* Connecting line — draws in left→right as the timeline reveals */}
            <div className="hidden sm:block absolute top-8 left-[22%] right-[22%] h-px bg-warm-border" data-reveal="line" style={{ transitionDuration: "1s" }} />

            {STEPS.map((s, i) => (
              <div key={s.n} className="relative text-center sm:text-left" data-reveal style={{ transitionDelay: `${i * 120}ms` }}>
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto sm:mx-0 mb-5 relative z-10"
                  style={{ background: "#E8ECF5", border: "1px solid #C8D4E8" }}
                >
                  <div style={{ color: "#1D4ED8" }}>{s.icon}</div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 tracking-widest mb-2 uppercase">{s.n}</p>
                <h3 className="text-slate-900 font-semibold text-base mb-2">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-warm-border bg-cream py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16" data-reveal>
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">Features</p>
            <h2 className="text-3xl font-bold text-slate-900">Everything you need to network smarter</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div key={f.title} data-reveal style={{ transitionDelay: `${(i % 3) * 80}ms` }}
                className="card-premium group bg-warm-card border border-warm-card-border rounded-2xl p-6 h-full">
                <div className="sc-card-icon w-9 h-9 rounded-xl bg-[#E8ECF5] flex items-center justify-center text-brand mb-4">
                  {f.icon}
                </div>
                <p className="text-slate-900 font-semibold text-sm mb-2">{f.title}</p>
                <p className="text-slate-500 text-sm leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-warm-border bg-cream-dark py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16" data-reveal>
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">Testimonials</p>
            <h2 className="text-3xl font-bold text-slate-900">What our users say</h2>
            <p className="text-slate-500 mt-3 text-sm max-w-md mx-auto">Join thousands of professionals who never lose a lead again.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div key={t.name} data-reveal style={{ transitionDelay: `${(i % 3) * 80}ms` }}
                className="card-premium bg-warm-card border border-warm-card-border rounded-2xl p-7 flex flex-col shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} viewBox="0 0 20 20" fill="#d97706" className="w-3.5 h-3.5">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: SOURCE_BADGE_COLORS[t.source] }}
                  >
                    {t.source}
                  </span>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed flex-1 mb-6">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: "#1D4ED8" }}
                  >
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-slate-900 font-semibold text-sm leading-tight">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-warm-border bg-cream py-28 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-16" data-reveal>
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">FAQ</p>
            <h2 className="text-3xl font-bold text-slate-900">Common questions</h2>
          </div>
          <div className="space-y-0 divide-y divide-warm-border">
            {FAQS.map((f, i) => (
              <div key={f.q} className="py-6" data-reveal="fade" style={{ transitionDelay: `${Math.min(i, 4) * 60}ms` }}>
                <p className="text-slate-900 font-semibold text-sm mb-2">{f.q}</p>
                <p className="text-slate-500 text-sm leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="sc-gradient-move py-28 px-6" style={{ background: "linear-gradient(120deg, #1D4ED8 0%, #2745c9 45%, #4f46e5 100%)", backgroundSize: "200% 200%" }}>
        <div className="max-w-xl mx-auto text-center" data-reveal>
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            Your next deal starts with a better introduction.
          </h2>
          <p className="text-white/70 mb-10">
            Set up your digital card in 30 seconds. Free to start, no credit card needed.
          </p>
          <Link
            href="/login?mode=signup"
            className="btn-cta inline-block bg-white hover:bg-cream text-brand font-semibold px-8 py-3.5 rounded-full text-sm"
          >
            Create your free card
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-warm-border py-12 px-6 bg-cream">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <SwiftCardLogo size={26} />
          <div className="flex items-center justify-center flex-wrap gap-x-5 gap-y-2 sm:gap-8 text-sm text-slate-500">
            <Link href="/preview" className="nav-link hover:text-slate-900 transition-colors">See it live</Link>
            <Link href="/pricing" className="nav-link hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/contact" className="nav-link hover:text-slate-900 transition-colors">Contact</Link>
            <Link href="/login" className="nav-link hover:text-slate-900 transition-colors">Sign in</Link>
            <Link href="/login?mode=signup" className="nav-link hover:text-slate-900 transition-colors">Get started</Link>
            <Link href="/privacy" className="nav-link hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="nav-link hover:text-slate-900 transition-colors">Terms</Link>
          </div>
          <p className="text-slate-400 text-xs">© {new Date().getFullYear()} SwiftCard · New York, NY. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
