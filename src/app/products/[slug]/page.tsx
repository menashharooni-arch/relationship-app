import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollProgress from "@/components/ScrollProgress";
import LeadCapturePhone from "@/components/site/LeadCapturePhone";
import SignatureDemo from "@/components/site/SignatureDemo";
import DashboardDemo from "@/components/site/DashboardDemo";
import TemplateGallery from "@/components/site/TemplateGallery";
import SwiftLinksPhone from "@/components/site/SwiftLinksPhone";
import ShareWaysPhones from "@/components/site/ShareWaysPhones";
import WatchShareImage from "@/components/site/WatchShareImage";
import { INTEGRATIONS, integrationNames } from "@/components/site/integration-brands";
import TeamsDashboard from "@/components/site/TeamsDashboard";
import NativeHidden from "@/components/NativeHidden";
import NativeFeatureNote from "@/components/NativeFeatureNote";

type Feature = { t: string; d: string };
type Product = {
  eyebrow: string;
  title: React.ReactNode;
  titlePlain: string;
  subtitle: string;
  demo: React.ReactNode;
  wide?: boolean; // demo spans full width below the hero copy
  ctaLabel?: string; // hero button label (defaults to "Create your free card")
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
    demo: (
      <div className="w-full rounded-[28px] bg-[#FBF8F0] p-5 sm:p-7 shadow-2xl">
        <TemplateGallery />
      </div>
    ),
    wide: true,
    features: [
      { t: "Six designer templates", d: "Photo-first, logo-first, classic, bold, minimal — all fully customizable to your brand in seconds." },
      { t: "Tap, QR, or link", d: "Works on every phone with no app. A tap on your NFC card, a scannable QR, or a simple shareable link." },
      { t: "Save Contact, built in", d: "Your name, number, email and photo drop straight into their contacts as a vCard." },
      { t: "Unlimited cards on Pro", d: "A card for each side of you — work, personal, speaking — each with its own analytics." },
    ],
    metaDesc: "Beautiful, customizable digital business cards that share themselves with one tap — QR, NFC, or link, no app required.",
  },
  swiftlinks: {
    eyebrow: "SwiftLinks",
    title: <>Everything to do. <A>One SwiftLink.</A></>,
    titlePlain: "SwiftLinks",
    subtitle: "Your bio, your socials, your booking link, your latest drop — one beautiful page that lives in your Instagram, TikTok, or email. Separate from your card, powered by the same profile.",
    demo: <SwiftLinksPhone />,
    features: [
      { t: "Unlimited links & socials", d: "Add as many buttons and platforms as you like, reorder anytime." },
      { t: "Capture leads on the page", d: "A built-in connect form turns visitors into saved contacts." },
      { t: "On-brand, always live", d: "Matches your colors and updates in real time — change once, everywhere." },
      { t: "Made for your bio", d: "Drop it in your Instagram or TikTok bio and send traffic that converts." },
    ],
    metaDesc: "SwiftLinks — one beautiful link-in-bio page for your bio, socials, and links, with lead capture built in.",
    // Product-correct CTA — still lands on /cards/new (the SwiftLink lives on
    // the same card record; the builder covers it), only the label changes.
    ctaLabel: "Create your free SwiftLink",
  },
  "email-signatures": {
    eyebrow: "Swift Signature",
    title: <>Every email you send, <A>advertising you.</A></>,
    titlePlain: "Swift Signature",
    subtitle: "Drop your live SwiftCard into your email signature once with Swift Signature. Now every message ends with a clickable card — recipients open it, save your contact, and reach out in a single tap.",
    ctaLabel: "Create your free Swift Signature",
    demo: (
      <div className="w-full rounded-[28px] bg-[#F5F0E3] p-5 sm:p-8 shadow-2xl">
        <SignatureDemo />
      </div>
    ),
    wide: true,
    features: [
      { t: "Copy once, paste anywhere", d: "Works in Gmail, Outlook, Apple Mail — any client that supports HTML signatures." },
      { t: "Always up to date", d: "Change your title or number and every future email reflects it automatically." },
      { t: "Clickable, not decorative", d: "One tap opens your card, saves your contact, or reaches you directly." },
      { t: "A tiny billboard", d: "Every reply becomes a professional advertisement for you and your brand." },
    ],
    metaDesc: "Swift Signature turns your email signature into a live, clickable SwiftCard — recipients open, save, and reach out in one tap.",
  },
  "lead-capture": {
    eyebrow: "Lead Capture",
    title: <>Turn every scan into a <A>relationship.</A></>,
    titlePlain: "Lead Capture",
    subtitle: "When someone opens your card, they can share their info right back — straight into your contacts, with where and when you met. Then you follow up by email or text, and they can text you back. No more lost napkins or half-typed numbers.",
    demo: <LeadCapturePhone />,
    // Every claim below is enforced in code — the texting ones especially, since
    // they are new. Registered sender: A2P 10DLC campaign COJQ2MB, approved
    // 2026-08-13. Consent gate: the sms-ok tag, set only by the checkbox on the
    // capture form; reminders/route.ts refuses to text without it. Inbound:
    // api/twilio/inbound logs replies to lead_messages. Manual send: api/sms/send
    // checks auth and sms-paused, NOT the plan — so it really is every plan.
    // Sequences: reminders/route.ts hard-gates on isPaidPlan, hence "on Pro".
    features: [
      { t: "Two-way exchange", d: "They save you, you capture them — the whole handshake in one tap." },
      { t: "Context that sticks", d: "Every lead is tagged with the card, time, and location they came from." },
      { t: "Texts that actually arrive", d: "SwiftCard is a carrier-registered sender, so your follow-up lands in their messages instead of being filtered out on the way." },
      { t: "Only the people who asked", d: "A text goes out only to someone who ticked the consent box on your card. No box, no text — and STOP is honored instantly." },
      { t: "They text back, you see it", d: "Replies land in that contact's conversation, next to the views and the notes. One thread, not a second inbox." },
      { t: "Reply from your dashboard", d: "Answer by text or email from the contact's page, in your name. On every plan, including Free." },
      { t: "Sequences that run themselves", d: "Set an email and text follow-up once and it sends on your schedule — never outside 8am–9pm their time. On Pro." },
      { t: "Straight to your CRM", d: "Contacts flow into your dashboard and sync to GoHighLevel, Pipedrive, HubSpot or Google Contacts." },
    ],
    metaDesc: "Capture leads the moment someone opens your card — two-way contact exchange, follow-up by email or text from a registered sender, and replies that land in one thread.",
  },
  analytics: {
    eyebrow: "Dashboard & Analytics",
    title: <>See who&apos;s looking. <A>Never lose a lead.</A></>,
    titlePlain: "Dashboard & Analytics",
    subtitle: "Real-time views, saves, and locations. Every contact who taps your card lands in one searchable place — with full history, their replies, and automated follow-ups. Try the dashboard right here.",
    demo: <DashboardDemo />,
    wide: true,
    features: [
      { t: "Live traffic", d: "SwiftCard and Swift Link views by day, week, and month — see momentum build." },
      { t: "Top locations", d: "Know exactly where your card is getting opened, city by city." },
      // "A real CRM" listed the parts and skipped the thing that changed: the
      // timeline is now two-way. api/twilio/inbound writes replies into
      // lead_messages, so a text back appears in the same thread as the views.
      { t: "One thread per person", d: "Notes, read/unread, every view — and the emails and texts you've exchanged, in the order they happened." },
      { t: "Follow-up on autopilot", d: "Light, medium, or aggressive email and text sequences, written by AI. On Pro." },
    ],
    metaDesc: "SwiftCard's dashboard: real-time views, saves, top locations, and a built-in CRM where replies and automated follow-ups live in one thread.",
  },
  teams: {
    eyebrow: "Teams & Offices",
    title: <>One brand. <A>Everyone on it.</A></>,
    titlePlain: "Teams & Offices",
    subtitle: "Roll out cards across your whole team with consistent branding, shared templates, and one place to manage seats. Every rep looks sharp — and every lead is accounted for.",
    demo: <TeamsDashboard />,
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
    eyebrow: "Ways to share",
    title: <>Your card, always <A>in your pocket.</A></>,
    titlePlain: "Apple Wallet",
    // The demo shows two phones since the standalone QR phone came out — the
    // pass carries the QR itself, so a third phone said nothing the first
    // didn't. Copy now matches: Wallet (QR included) and the share sheet, in
    // that order. Downloading the QR is still real and still mentioned.
    subtitle: "However you meet someone, there's a way to hand them your card in a second — your Apple Wallet pass, with the QR right on it, or the share sheet. No app, no signal, no fumbling. You can also download your card's QR code to display at events, add it as a home-screen widget, or use it in any other sharing format that fits the moment.",
    demo: <ShareWaysPhones />,
    wide: true,
    ctaLabel: "Get Started",
    features: [
      { t: "One tap to add", d: "Save your card to Wallet and reach it from your lock screen instantly." },
      { t: "Works offline", d: "No signal needed — your QR is right there whenever you need it." },
      // Not marketing licence: wallet.ts registers a webServiceURL +
      // authenticationToken, api/wallet/v1/* implements the full PassKit device
      // registration spec, and touchWalletPass pushes on change — hot-hooked to
      // the card editor with a daily sweep behind it. The pass genuinely
      // re-downloads itself; the old "updates too" undersold a real mechanism.
      { t: "Updates itself", d: "Change your title or your number and the pass in your Wallet redraws itself — Apple fetches the new one. Nothing to re-add, nothing left stale." },
      { t: "Right where they look", d: "Sitting next to the cards people already pull out every day." },
    ],
    metaDesc: "Add your SwiftCard to Apple Wallet — your digital business card, always a swipe away, even offline.",
  },
  watch: {
    eyebrow: "Apple Watch",
    // Exact message requested by the owner.
    title: <>Make your Apple Watch into a <A>scannable business card</A> you take with you everywhere.</>,
    titlePlain: "Apple Watch",
    subtitle: "Raise your wrist, show your code, and share your details hands-free — no phone required. Your card goes wherever you go.",
    demo: <WatchShareImage />,
    features: [
      { t: "Hands-free sharing", d: "Show your card from your wrist — perfect for events, gyms, and on the move." },
      { t: "Always with you", d: "No reaching for your phone. Your details are one glance away." },
      { t: "Scannable code", d: "A crisp QR your Watch displays so anyone can open your full card." },
      { t: "Powered by your card", d: "Everything stays in sync with the card and profile you already have." },
    ],
    metaDesc: "Make your Apple Watch a scannable business card you take everywhere — share your details hands-free.",
  },
  integrations: {
    eyebrow: "Integrations",
    title: <>Your leads flow into <A>the tools you already use.</A></>,
    titlePlain: "Integrations",
    subtitle: "The moment someone shares their info, SwiftCard pushes that contact straight into your CRM and the apps your team runs on — in real time. No CSV shuffling, no copy-paste, no lead sitting in a dashboard nobody opens.",
    demo: (
      <div className="w-[340px] max-w-full flex flex-col items-center">
        {/* the lead that just came in */}
        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 flex items-center gap-3 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.7)]">
          <span className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0" style={{ background: "var(--rd-aurora)" }}>SC</span>
          <span className="min-w-0">
            <span className="block text-white text-[14px] font-semibold leading-tight">Sarah Chen</span>
            <span className="block text-white/45 text-[12px] leading-tight">just shared her info · via QR</span>
          </span>
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/25 shrink-0">New lead</span>
        </div>
        {/* flows automatically to… */}
        <div className="flex flex-col items-center py-2.5">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/30" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
          <span className="text-white/40 text-[11px] font-medium tracking-wide">synced automatically</span>
        </div>
        {/* …into your tools. Same canonical list as the homepage band. */}
        <div className="grid grid-cols-2 gap-3 w-full">
          {INTEGRATIONS.map((it) => (
            <div key={it.name} className="rounded-xl bg-white px-3 py-2.5 flex items-center gap-2.5 shadow-[0_14px_34px_-20px_rgba(0,0,0,0.6)]">
              <span className="w-7 h-7 flex items-center justify-center shrink-0">{it.logo}</span>
              <span className="min-w-0">
                <span className="block text-slate-800 text-[12.5px] font-bold leading-tight truncate">{it.name}</span>
                <span className="block text-slate-400 text-[10.5px] leading-tight truncate">{it.short}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    // Derived from the canonical list so a new integration appears here the
    // moment it's added, instead of being forgotten for a release.
    features: INTEGRATIONS.map((i) => ({ t: i.name, d: i.blurb })),
    metaDesc: `Connect SwiftCard to ${integrationNames()}. Every lead you capture flows into the tools you already use, in real time.`,
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

  // The "Preview" (see-it-live) CTA is hidden on these product pages per owner
  // request — they showcase the real thing inline instead.
  const showPreview = !["digital-cards", "swiftlinks", "email-signatures", "lead-capture", "wallet", "watch", "integrations", "teams"].includes(slug);

  // In-app honesty clarifiers (App Review 2.3.1): inside the iOS shell these
  // marketing pages are in-app content, so aspirational phrasing gets an
  // exact "how it works today" note. NativeFeatureNote renders null on web.
  const nativeNote =
    slug === "watch" ? (
      <NativeFeatureNote>
        How this works today: add your card to Apple Wallet on your iPhone and the pass — QR code included — syncs to the Wallet app on your Apple Watch. A dedicated watchOS app is on our roadmap and isn&apos;t part of this version.
      </NativeFeatureNote>
    ) : slug === "wallet" ? (
      <NativeFeatureNote>
        In this version of the app: Apple Wallet, QR download, and share-sheet sharing are available today. The home-screen QR widget appears once you add it from your iPhone home screen&apos;s widget gallery.
      </NativeFeatureNote>
    ) : null;

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
                {nativeNote}
                <div className="mt-8 flex flex-wrap gap-3" data-reveal>
                  <Link href="/cards/new" className="rd-btn rd-btn-aurora rd-btn-lg">{p.ctaLabel ?? "Create your free card"}</Link>
                  {showPreview && <Link href="/preview" className="rd-btn rd-btn-ghost-d rd-btn-lg">Preview</Link>}
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
                {nativeNote}
                <div className="mt-8 flex flex-wrap gap-3" data-reveal>
                  <Link href="/cards/new" className="rd-btn rd-btn-aurora rd-btn-lg">{p.ctaLabel ?? "Create your free card"}</Link>
                  {showPreview && <Link href="/preview" className="rd-btn rd-btn-ghost-d rd-btn-lg">Preview</Link>}
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
          </div>
        </section>

        {/* Deep dive — teams & offices only */}
        {slug === "teams" && (
          <section className="relative py-24 overflow-hidden border-t border-white/10" style={{ background: "var(--rd-ink-1000)" }}>
            <div className="absolute inset-0 opacity-70" style={{ background: "radial-gradient(70% 90% at 15% 0%, rgba(93,107,255,0.18), transparent 60%)" }} />
            <div className="relative max-w-5xl mx-auto px-5 sm:px-6">
              <div className="max-w-2xl" data-reveal>
                <p className="text-[13px] font-semibold tracking-[0.14em] uppercase" style={{ color: "#4DA8F5" }}>What you get</p>
                <h2 className="rd-h2 text-white text-[clamp(1.9rem,3.6vw,2.6rem)] mt-3">One office account. Total control, zero busywork.</h2>
                <p className="text-white/60 text-[1.05rem] mt-4 leading-relaxed">You set the brand once — every card your team creates inherits it automatically. From there, it&rsquo;s a single dashboard to see how the whole team is doing, not a spreadsheet of who has what.</p>
              </div>

              <div className="mt-12 grid md:grid-cols-3 gap-4">
                {[
                  { t: "Brand it once", d: "Set your logo, colors, and a locked template. Every card anyone on your team creates — today or a year from now — is on-brand automatically. No one can go rogue with their own look." },
                  { t: "Everyone gets their own card", d: "Each teammate gets a personal card with their name, title, and photo — their own Swift Links, their own Swift Signature, their own contacts. Same brand, their identity." },
                  { t: "Admin sees everyone at a glance", d: "One dashboard shows every member's card, activity, and lead count. Spot who's actively sharing their card and who needs a nudge — without asking around." },
                  { t: "Add people in seconds", d: "Invite a teammate by email and their card is ready before the meeting ends. No IT ticket, no design request, no waiting on a template." },
                  { t: "Unlimited seats, always", d: "There's no cap on team size and no separate contract to add someone. Add or remove seats anytime from inside the account as your team grows or changes." },
                  { t: "Team leads, not just admins", d: "Promote someone to manage their own group — new hires, a regional office, a department — without handing them the keys to the whole account." },
                ].map((s, i) => (
                  <div key={s.t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6" data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4" style={{ background: "var(--rd-aurora)" }}>
                      <svg viewBox="0 0 20 20" className="w-4.5 h-4.5 text-white" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4L8.5 12l6.8-6.7a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                    </div>
                    <p className="text-white font-semibold text-[16px]">{s.t}</p>
                    <p className="text-white/55 text-[14px] mt-1.5 leading-relaxed">{s.d}</p>
                  </div>
                ))}
              </div>

              <div className="mt-16 max-w-2xl" data-reveal>
                <p className="text-[13px] font-semibold tracking-[0.14em] uppercase" style={{ color: "#4DA8F5" }}>Built for</p>
                <h2 className="rd-h2 text-white text-[clamp(1.6rem,3vw,2.1rem)] mt-3">Any team that shows up as one brand.</h2>
              </div>
              <div className="mt-8 grid sm:grid-cols-2 gap-4">
                {[
                  { t: "Real estate teams & brokerages", d: "Every agent's card matches the brokerage brand, but leads from open houses and showings land with the right agent — not a shared inbox." },
                  { t: "Sales & account teams", d: "Reps hand out on-brand cards at every meeting and conference. Leads flow straight to their own dashboard, and you can see who's actually working the room." },
                  { t: "Agencies & studios", d: "New hires and freelancers get a card the moment they join — same polish as everyone else — and it's revoked the moment they leave." },
                  { t: "Multi-location businesses", d: "One brand across every office. Each location's staff gets their own card and contacts, while you keep a single view across all of them." },
                ].map((s, i) => (
                  <div key={s.t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6" data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                    <p className="text-white font-semibold text-[15px]">{s.t}</p>
                    <p className="text-white/55 text-[13.5px] mt-1.5 leading-relaxed">{s.d}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-white/45 text-[13px]" data-reveal>
                <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />No cap on seats</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />One bill for the whole team</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Add or remove people anytime</span>
              </div>
            </div>
          </section>
        )}

        {/* How it works — integrations only */}
        {slug === "integrations" && (
          <section className="relative py-24 overflow-hidden border-t border-white/10" style={{ background: "var(--rd-ink-1000)" }}>
            <div className="absolute inset-0 opacity-70" style={{ background: "radial-gradient(70% 90% at 15% 0%, rgba(93,107,255,0.18), transparent 60%)" }} />
            <div className="relative max-w-5xl mx-auto px-5 sm:px-6">
              <div className="max-w-2xl" data-reveal>
                <p className="text-[13px] font-semibold tracking-[0.14em] uppercase" style={{ color: "#4DA8F5" }}>How it works</p>
                <h2 className="rd-h2 text-white text-[clamp(1.9rem,3.6vw,2.6rem)] mt-3">From a handshake to your CRM — hands-off.</h2>
                <p className="text-white/60 text-[1.05rem] mt-4 leading-relaxed">You never touch a spreadsheet. The second a lead comes in, SwiftCard captures the full context and routes it everywhere it needs to go — while you&rsquo;re still shaking hands.</p>
              </div>
              <div className="mt-12 grid md:grid-cols-3 gap-4">
                {[
                  { n: "1", t: "They share their info", d: "A tap on Save Contact or a quick form on your card — no app to download, no typing your details out for them." },
                  { n: "2", t: "SwiftCard captures the context", d: "Name, email, phone, plus which card they scanned, when, and where you met — all attached to the lead automatically." },
                  { n: "3", t: "It lands in your stack", d: "Synced to GoHighLevel, Pipedrive, HubSpot or Google Contacts, piped to 6,000+ apps through Zapier, or exported as CSV — in real time, no manual step." },
                ].map((s, i) => (
                  <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[15px] font-bold mb-4" style={{ background: "var(--rd-aurora)" }}>{s.n}</div>
                    <p className="text-white font-semibold text-[16px]">{s.t}</p>
                    <p className="text-white/55 text-[14px] mt-1.5 leading-relaxed">{s.d}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-white/45 text-[13px]" data-reveal>
                <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Real-time — no nightly sync</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />No code required</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Your data stays yours</span>
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="relative py-24 overflow-hidden" style={{ background: "var(--rd-ink-1000)" }}>
          <div className="absolute inset-0 opacity-90" style={{ background: "radial-gradient(80% 120% at 50% 120%, rgba(93,107,255,0.32), transparent 60%)" }} />
          <div className="relative max-w-2xl mx-auto px-5 sm:px-6 text-center">
            <h2 className="rd-h2 text-white text-[clamp(2rem,4.4vw,3.2rem)]" data-reveal>Ready to be unforgettable?</h2>
            <p className="text-white/60 text-[1.08rem] mt-4" data-reveal>Your free SwiftCard is 60 seconds away.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3" data-reveal>
              <Link href="/cards/new" className="rd-btn rd-btn-aurora rd-btn-lg">Create your free card</Link>
              <NativeHidden><Link href="/pricing" className="rd-btn rd-btn-ghost-d rd-btn-lg">See pricing</Link></NativeHidden>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
