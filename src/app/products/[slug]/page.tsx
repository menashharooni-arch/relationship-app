import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollProgress from "@/components/ScrollProgress";
import PhoneShowcase from "@/components/site/PhoneShowcase";
import SignatureDemo from "@/components/site/SignatureDemo";
import DashboardDemo from "@/components/site/DashboardDemo";
import WalletScene from "@/components/site/WalletScene";
import WatchScene from "@/components/site/WatchScene";
import SwiftCardVisual from "@/components/site/SwiftCardVisual";

type Feature = { t: string; d: string };
type Product = {
  eyebrow: string;
  title: React.ReactNode;
  titlePlain: string;
  subtitle: string;
  demo: React.ReactNode;
  wide?: boolean; // demo spans full width below the hero copy
  features: Feature[];
  metaDesc: string;
};

function A({ children }: { children: React.ReactNode }) {
  return <span className="rd-aurora-text">{children}</span>;
}

const PRODUCTS: Record<string, Product> = {
  "digital-cards": {
    eyebrow: "Digital Cards",
    title: <>A card so good, people <A>want</A> to keep it.</>,
    titlePlain: "Digital Cards",
    subtitle: "Designer templates, your colors, your photo, your logo — a scannable QR and a Save Contact button built in. Share it with a tap, a QR, or a link, and land straight in their phone.",
    demo: <PhoneShowcase variant="card" />,
    features: [
      { t: "Five designer templates", d: "Photo-first, classic, bold, minimal — all fully customizable to your brand in seconds." },
      { t: "Tap, QR, or link", d: "Works on every phone with no app. NFC tap, a scannable QR, or a simple shareable link." },
      { t: "Save Contact, built in", d: "Your name, number, email and photo drop straight into their contacts as a vCard." },
      { t: "Unlimited cards on Pro", d: "A card for each side of you — work, personal, speaking — each with its own analytics." },
    ],
    metaDesc: "Beautiful, customizable digital business cards that share themselves with one tap — QR, NFC, or link, no app required.",
  },
  swiftlinks: {
    eyebrow: "SwiftLinks",
    title: <>One link for <A>everything</A> you are.</>,
    titlePlain: "SwiftLinks",
    subtitle: "Your bio, your socials, your booking link, your latest drop — one beautiful page that lives in your Instagram, TikTok, or email. Separate from your card, powered by the same profile.",
    demo: <PhoneShowcase variant="link" />,
    features: [
      { t: "Unlimited links & socials", d: "Add as many buttons and platforms as you like, reorder anytime." },
      { t: "Capture leads on the page", d: "A built-in connect form turns visitors into saved contacts." },
      { t: "On-brand, always live", d: "Matches your colors and updates in real time — change once, everywhere." },
      { t: "Made for your bio", d: "Drop it in your Instagram or TikTok bio and send traffic that converts." },
    ],
    metaDesc: "SwiftLinks — one beautiful link-in-bio page for your bio, socials, and links, with lead capture built in.",
  },
  "email-signatures": {
    eyebrow: "Email Signatures",
    title: <>Every email you send, <A>advertising you.</A></>,
    titlePlain: "Email Signatures",
    subtitle: "Drop your live SwiftCard into your signature once. Now every message ends with a clickable card — recipients open it, save your contact, and reach out in a single tap.",
    demo: <SignatureDemo />,
    wide: true,
    features: [
      { t: "Copy once, paste anywhere", d: "Works in Gmail, Outlook, Apple Mail — any client that supports HTML signatures." },
      { t: "Always up to date", d: "Change your title or number and every future email reflects it automatically." },
      { t: "Clickable, not decorative", d: "One tap opens your card, saves your contact, or reaches you directly." },
      { t: "A tiny billboard", d: "Every reply becomes a professional advertisement for you and your brand." },
    ],
    metaDesc: "Turn your email signature into a live, clickable SwiftCard — recipients open, save, and reach out in one tap.",
  },
  "lead-capture": {
    eyebrow: "Lead Capture",
    title: <>Turn every scan into a <A>relationship.</A></>,
    titlePlain: "Lead Capture",
    subtitle: "When someone opens your card, they can share their info right back — straight into your contacts, with where and when you met. No more lost napkins or half-typed numbers.",
    demo: <PhoneShowcase variant="card" />,
    features: [
      { t: "Two-way exchange", d: "They save you, you capture them — the whole handshake in one tap." },
      { t: "Context that sticks", d: "Every lead is tagged with the card, time, and location they came from." },
      { t: "Straight to your CRM", d: "Contacts flow into your dashboard and sync to Zapier, Google, or HubSpot." },
      { t: "Automated follow-up", d: "Fire off a warm email or text sequence so a lead never goes cold." },
    ],
    metaDesc: "Capture leads the moment someone opens your card — two-way contact exchange with context and automated follow-up.",
  },
  analytics: {
    eyebrow: "Dashboard & Analytics",
    title: <>See who&apos;s looking. <A>Never lose a lead.</A></>,
    titlePlain: "Dashboard & Analytics",
    subtitle: "Real-time views, saves, and locations. Every contact who taps your card lands in one searchable place — with full history and automated follow-ups. Try the dashboard right here.",
    demo: <DashboardDemo />,
    wide: true,
    features: [
      { t: "Live traffic", d: "SwiftCard and Swift Link views by day, week, and month — see momentum build." },
      { t: "Top locations", d: "Know exactly where your card is getting opened, city by city." },
      { t: "A real CRM", d: "Statuses, notes, read/unread, and a full timeline for every contact." },
      { t: "Follow-up on autopilot", d: "Light, medium, or aggressive email and text sequences, written by AI." },
    ],
    metaDesc: "SwiftCard's dashboard: real-time views, saves, top locations, and a built-in CRM with automated follow-ups.",
  },
  teams: {
    eyebrow: "Teams & Offices",
    title: <>One brand. <A>Everyone on it.</A></>,
    titlePlain: "Teams & Offices",
    subtitle: "Roll out cards across your whole team with consistent branding, shared templates, and one place to manage seats. Every rep looks sharp — and every lead is accounted for.",
    demo: <DashboardDemo />,
    wide: true,
    features: [
      { t: "Uniform branding", d: "Lock the logo, colors, and template so every card is unmistakably on-brand." },
      { t: "A card per member", d: "Everyone gets their own card and analytics under one shared office." },
      { t: "Seats & roles", d: "Add or remove people in seconds. One bill, full admin control." },
      { t: "Bulk import", d: "Bring your existing contacts in by CSV and get the whole team running fast." },
    ],
    metaDesc: "Roll out on-brand digital cards across your whole team, with shared templates, seat management, and team analytics.",
  },
  wallet: {
    eyebrow: "Apple Wallet",
    title: <>Your card, always <A>in your pocket.</A></>,
    titlePlain: "Apple Wallet",
    subtitle: "Add your SwiftCard to Apple Wallet and it's a swipe away — right next to your boarding passes and payment cards. Pull it up, let them scan, done. No signal, no app, no fumbling.",
    demo: (
      <div className="flex flex-wrap items-center justify-center gap-8">
        <WalletScene />
        <div className="text-center">
          <p className="text-white/40 text-[12px] font-semibold uppercase tracking-wide mb-3">What they see when they scan</p>
          <PhoneShowcase variant="card" />
        </div>
      </div>
    ),
    wide: true,
    features: [
      { t: "One tap to add", d: "Save your card to Wallet and reach it from your lock screen instantly." },
      { t: "Works offline", d: "No signal needed — your QR is right there whenever you need it." },
      { t: "Always current", d: "Update your details and your Wallet pass updates too." },
      { t: "Right where they look", d: "Sitting next to the cards people already pull out every day." },
    ],
    metaDesc: "Add your SwiftCard to Apple Wallet — your digital business card, always a swipe away, even offline.",
  },
  watch: {
    eyebrow: "Apple Watch",
    // Exact message requested by the owner.
    title: <>Make your Apple Watch into a <A>tappable business card</A> you take with you everywhere.</>,
    titlePlain: "Apple Watch",
    subtitle: "Raise your wrist, show your code, and share your details hands-free — no phone required. Your card goes wherever you go.",
    demo: <WatchScene />,
    features: [
      { t: "Hands-free sharing", d: "Show your card from your wrist — perfect for events, gyms, and on the move." },
      { t: "Always with you", d: "No reaching for your phone. Your details are one glance away." },
      { t: "Scannable code", d: "A crisp QR your Watch displays so anyone can open your full card." },
      { t: "Powered by your card", d: "Everything stays in sync with the card and profile you already have." },
    ],
    metaDesc: "Make your Apple Watch a tappable business card you take everywhere — share your details hands-free.",
  },
  integrations: {
    eyebrow: "Integrations",
    title: <>Your leads, <A>wherever you work.</A></>,
    titlePlain: "Integrations",
    subtitle: "Every contact you capture can flow straight into the tools you already use — no copy-paste, no exports, no lost leads.",
    demo: (
      <div className="grid grid-cols-2 gap-4 w-[340px]">
        {[["Zapier", "#FF4A00"], ["Google Contacts", "#4285F4"], ["HubSpot", "#FF7A59"], ["CSV Export", "#5D6BFF"]].map(([n, c]) => (
          <div key={n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col items-center justify-center gap-2 h-32">
            <span className="w-10 h-10 rounded-xl" style={{ background: c as string }} />
            <span className="text-white text-[13px] font-semibold text-center">{n}</span>
          </div>
        ))}
      </div>
    ),
    features: [
      { t: "Zapier", d: "Pipe new leads into 6,000+ apps with a single webhook — no code." },
      { t: "Google Contacts", d: "New contacts sync straight into your Google account automatically." },
      { t: "HubSpot", d: "Push every lead into your HubSpot CRM as it comes in." },
      { t: "CSV export", d: "Download your contacts any time — your data is always yours." },
    ],
    metaDesc: "Connect SwiftCard to Zapier, Google Contacts, and HubSpot — or export to CSV. Your leads, wherever you work.",
  },
};

export function generateStaticParams() {
  return Object.keys(PRODUCTS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = PRODUCTS[slug];
  if (!p) return { title: "SwiftCard" };
  return { title: `${p.titlePlain} — SwiftCard`, description: p.metaDesc };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = PRODUCTS[slug];
  if (!p) notFound();

  return (
    <div className="rd-dark2">
      <ScrollProgress />
      <div className="sc-scroll-progress" />
      <ScrollReveal />
      <SiteNav />

      <main className="overflow-clip">
        {/* Hero */}
        <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-24">
          <div className="rd-grid absolute inset-0 opacity-40" />
          <div className="rd-glow rd-glow-violet rd-drift-a" style={{ width: 520, height: 520, left: "-8%", top: "-14%" }} />
          <div className="rd-glow rd-glow-cyan rd-drift-b" style={{ width: 380, height: 380, right: "-6%", top: "6%", opacity: 0.3 }} />

          {p.wide ? (
            <div className="relative max-w-6xl mx-auto px-5 sm:px-6">
              <div className="max-w-3xl">
                <div data-reveal="fade"><span className="rd-pill rd-pill-d"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--rd-aurora)" }} />{p.eyebrow}</span></div>
                <h1 className="rd-display text-white text-[clamp(2.3rem,5vw,3.8rem)] mt-6" data-reveal>{p.title}</h1>
                <p className="text-white/60 text-[1.12rem] mt-5 leading-relaxed max-w-[620px]" data-reveal>{p.subtitle}</p>
                <div className="mt-8 flex flex-wrap gap-3" data-reveal>
                  <Link href="/login?mode=signup" className="rd-btn rd-btn-aurora rd-btn-lg">Create your free card</Link>
                  <Link href="/preview" className="rd-btn rd-btn-ghost-d rd-btn-lg">See it live</Link>
                </div>
              </div>
              <div className="mt-14 flex justify-center" data-reveal="fade">{p.demo}</div>
            </div>
          ) : (
            <div className="relative max-w-6xl mx-auto px-5 sm:px-6 grid lg:grid-cols-2 gap-14 items-center">
              <div>
                <div data-reveal="fade"><span className="rd-pill rd-pill-d"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--rd-aurora)" }} />{p.eyebrow}</span></div>
                <h1 className="rd-display text-white text-[clamp(2.3rem,5vw,3.8rem)] mt-6" data-reveal>{p.title}</h1>
                <p className="text-white/60 text-[1.12rem] mt-5 leading-relaxed max-w-[560px]" data-reveal>{p.subtitle}</p>
                <div className="mt-8 flex flex-wrap gap-3" data-reveal>
                  <Link href="/login?mode=signup" className="rd-btn rd-btn-aurora rd-btn-lg">Create your free card</Link>
                  <Link href="/preview" className="rd-btn rd-btn-ghost-d rd-btn-lg">See it live</Link>
                </div>
              </div>
              <div className="flex justify-center" data-reveal="scale">{p.demo}</div>
            </div>
          )}
        </section>

        {/* Features */}
        <section className="rd-light relative py-24">
          <div className="max-w-6xl mx-auto px-5 sm:px-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {p.features.map((f, i) => (
                <div key={f.t} className="rd-card-l p-6" data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--rd-aurora)" }}>
                    <svg viewBox="0 0 20 20" className="w-5 h-5 text-white" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4L8.5 12l6.8-6.7a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                  </div>
                  <p className="text-slate-900 font-semibold text-[16px]">{f.t}</p>
                  <p className="text-slate-500 text-[14px] mt-1.5 leading-relaxed">{f.d}</p>
                </div>
              ))}
            </div>
            {slug === "watch" && (
              <div className="mt-8 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 max-w-[560px]">
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="#5D6BFF" strokeWidth={1.8}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" strokeLinecap="round" /></svg>
                <p className="text-slate-500 text-[13.5px] leading-relaxed">
                  <span className="font-semibold text-slate-700">On the roadmap.</span> Today you can add your card to Apple Wallet and reach it from your Watch. A dedicated native watchOS app is in development — we&apos;ll only ship it once it&apos;s fully approved by Apple.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="relative py-24 overflow-hidden" style={{ background: "var(--rd-ink-1000)" }}>
          <div className="absolute inset-0 opacity-90" style={{ background: "radial-gradient(80% 120% at 50% 120%, rgba(93,107,255,0.32), transparent 60%)" }} />
          <div className="relative max-w-2xl mx-auto px-5 sm:px-6 text-center">
            <h2 className="rd-h2 text-white text-[clamp(2rem,4.4vw,3.2rem)]" data-reveal>Ready to be unforgettable?</h2>
            <p className="text-white/60 text-[1.08rem] mt-4" data-reveal>Your free SwiftCard is a minute away.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3" data-reveal>
              <Link href="/login?mode=signup" className="rd-btn rd-btn-aurora rd-btn-lg">Create your free card</Link>
              <Link href="/pricing" className="rd-btn rd-btn-ghost-d rd-btn-lg">See pricing</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
