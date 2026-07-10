import Link from "next/link";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import PreviewClient from "@/app/preview/PreviewClient";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollProgress from "@/components/ScrollProgress";
import CountUpStat from "@/components/CountUpStat";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import SiteHeader from "@/components/home/SiteHeader";
import { Marquee, TiltCard, FAQAccordion } from "@/components/home/HomeFX";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import { SAMPLE_DATA, withoutSocials } from "@/components/card-templates/types";

// The REAL demo card — actual product template, actual human headshot.
const DEMO_CARD = { ...withoutSocials(SAMPLE_DATA), photoUrl: "/demo/headshot.jpg" };

// ── Icons (crisp strokes — no emoji, no cartoons) ───────────────────────────
const I = {
  link: <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />,
  qr: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM13.5 15h2.25v2.25H13.5V15zM18 15h2.25v2.25H18V15zM13.5 19.5h2.25v.75H13.5v-.75zM18.75 18.75h1.5v1.5h-1.5v-1.5z" />,
  nfc: <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />,
  mail: <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />,
  bio: <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c1.657 0 3-4.03 3-9s-1.343-9-3-9-3 4.03-3 9 1.343 9 3 9zm-8.716-6h17.432M3.284 9h17.432" />,
  share: <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />,
  check: <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.79 6.8-6.79a1 1 0 011.4 0z" clipRule="evenodd" />,
  star: <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />,
};

const Stars = ({ n = 5, size = "w-3.5 h-3.5" }: { n?: number; size?: string }) => (
  <span className="flex gap-0.5">{[...Array(n)].map((_, i) => <svg key={i} viewBox="0 0 20 20" fill="#d97706" className={size}>{I.star}</svg>)}</span>
);

// ── Content ──────────────────────────────────────────────────────────────────

const SHARE_WAYS = [
  { icon: I.qr, title: "QR code", body: "A real, scannable code lives on your card. They point, scan, save." },
  { icon: I.link, title: "One link", body: "Text it, DM it, drop it anywhere. Opens instantly in any browser." },
  { icon: I.nfc, title: "NFC tap", body: "Write your link to any NFC card. Tap their phone — done." },
  { icon: I.mail, title: "Email signature", body: "A pixel-exact picture of your card in every email you send." },
  { icon: I.bio, title: "Link in bio", body: "Your Swift Links page slots into Instagram or TikTok." },
  { icon: I.share, title: "Share sheet", body: "AirDrop it, text it, post it — if your phone can share it, your card rides along." },
];

const REVIEWS = [
  { quote: "I handed out 200 paper cards at a conference and got zero follow-ups. With SwiftCard I closed 3 deals from one event.", name: "John Chicoine", role: "Commercial Real Estate Broker", source: "LinkedIn" },
  { quote: "SwiftCard makes me look polished, and my clients always comment on how easy it was to save my contact.", name: "Aaron Bennett", role: "Senior Mortgage Broker", source: "App Store" },
  { quote: "The automated follow-ups are a game changer. Leads used to forget me — now they don't.", name: "Marcus Webb", role: "Startup Founder", source: "G2" },
  { quote: "I replaced our entire team's paper cards in one afternoon. I can see every rep's numbers in real time.", name: "Priya Shankar", role: "VP of Marketing", source: "LinkedIn" },
  { quote: "I tap my NFC card to someone's phone and they have everything in seconds. Most impressive thing I do in meetings.", name: "Derek Fontaine", role: "Insurance Agent", source: "App Store" },
  { quote: "Analytics showed 80% of my views came from Instagram — so I doubled down on what was actually working.", name: "Stephanie Owens", role: "Independent Consultant", source: "G2" },
];

const SOURCE_COLORS: Record<string, string> = { LinkedIn: "#0A66C2", "App Store": "#007AFF", G2: "#FF492C" };

const FAQS = [
  { q: "Does the other person need an app?", a: "No. Your card opens in any browser instantly and saves to their phone in one tap — no app, no account, no friction." },
  { q: "What happens when someone shares their info with me?", a: "They land in your contacts instantly — name, phone, email, where they found you, even their city. You get a notification and an email the moment it happens, and AI can draft your follow-up." },
  { q: "What is Swift Links?", a: "Every card comes with a link-in-bio page — your photo, bio, socials, and buttons at one link. Made for your Instagram or TikTok bio, and it captures leads just like your card." },
  { q: "Can my card live in my email signature?", a: "Yes — one click copies a pixel-exact picture of your live card into your signature, with tap-to-call and email links. Update your card and the signature updates with it." },
  { q: "Free vs Pro — what's the difference?", a: "Free: 1 card, 5 new leads a month, all 5 templates, unlimited Swift Links buttons, analytics with top locations, a Day-1 follow-up, 3 AI drafts and 3 card scans a month. Pro removes every monthly limit and adds unlimited cards, the drag-and-drop designer, automated email + text sequences, full analytics, CSV export and integrations." },
  { q: "Can I cancel anytime?", a: "Yes. No contracts. Cancel whenever — you keep access until the end of your billing period." },
];

// ── Product UI vignettes (real dashboard look — dark, exact, no cartoons) ───

function LeadRow({ name, meta, time, unread }: { name: string; meta: string; time: string; unread?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <span className={`w-1.5 h-1.5 rounded-full ${unread ? "bg-blue-500" : "bg-gray-700"}`} />
      <span className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-300 text-[9px] font-bold flex items-center justify-center">
        {name.split(" ").map((x) => x[0]).join("")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10.5px] font-semibold text-white truncate">{name}</span>
        <span className="block text-[8.5px] text-gray-500 truncate">{meta}</span>
      </span>
      <span className="text-[8px] text-gray-600">{time}</span>
    </div>
  );
}

function CrmVignette() {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4 w-full max-w-[380px] shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white text-xs font-bold">Contacts</p>
        <span className="text-[9px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">2 new today</span>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 divide-y divide-gray-800/70">
        <LeadRow name="Sarah Kim" meta="Shared her info · Instagram" time="2m" unread />
        <LeadRow name="Mike Torres" meta="Saved your contact · QR scan" time="1h" unread />
        <LeadRow name="Dana Patel" meta="Viewed your card · New York" time="3h" />
      </div>
      <div className="mt-3 rounded-xl border border-emerald-900/60 bg-emerald-950/40 px-3 py-2.5">
        <p className="text-[10px] font-semibold text-emerald-300">Day-1 follow-up sent to Sarah</p>
        <p className="text-[8.5px] text-emerald-500/70 mt-0.5">Written by AI from your notes — signed with your card</p>
      </div>
    </div>
  );
}

function AutomationVignette() {
  const steps = [
    { d: "Day 1", m: "Great meeting you at the expo — here's everything in one place.", on: true },
    { d: "Day 14", m: "Checking in — how did the proposal land with your team?", on: true },
    { d: "Day 28", m: "Circling back in case the timing is better now.", on: false },
  ];
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4 w-full max-w-[380px] shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white text-xs font-bold">Email automation</p>
        <span className="text-[9px] font-semibold text-gray-400 bg-gray-800 rounded-full px-2 py-0.5">Medium cadence</span>
      </div>
      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.d} className="rounded-xl border border-gray-800 bg-gray-900/60 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[8.5px] font-bold text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">{s.d}</span>
              <span className={`w-7 h-4 rounded-full relative transition-colors ${s.on ? "bg-blue-600" : "bg-gray-700"}`}>
                <span className={`absolute top-[2.5px] w-3 h-3 rounded-full bg-white ${s.on ? "right-[2.5px]" : "left-[2.5px]"}`} />
              </span>
            </div>
            <p className="text-[10px] text-gray-400 leading-snug">{s.m}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream flex flex-col overflow-x-clip">
      <ScrollProgress />
      <ScrollReveal />
      <StickyMobileCTA />
      <SiteHeader />

      {/* ══ HERO — editorial type, real card, real person ══ */}
      <section className="relative max-w-6xl mx-auto w-full px-5 sm:px-6 pt-14 sm:pt-20 pb-16">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
          <div className="sc-blob sc-blob-a" style={{ width: 420, height: 420, top: -120, left: -80, background: "radial-gradient(circle, rgba(29,78,216,0.15), transparent 70%)" }} />
          <div className="sc-blob sc-blob-b" style={{ width: 360, height: 360, bottom: -60, right: -60, background: "radial-gradient(circle, rgba(124,58,237,0.11), transparent 70%)" }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
          <div>
            <h1 className="text-[3.1rem] sm:text-[4rem] font-bold text-slate-900 leading-[0.98] tracking-[-0.03em]">
              <span className="sc-word" style={{ ["--sc-wd" as string]: "100ms" } as React.CSSProperties}>Never</span>{" "}
              <span className="sc-word" style={{ ["--sc-wd" as string]: "160ms" } as React.CSSProperties}>hand</span>{" "}
              <span className="sc-word" style={{ ["--sc-wd" as string]: "220ms" } as React.CSSProperties}>out</span>
              <br />
              <span className="sc-word" style={{ ["--sc-wd" as string]: "300ms" } as React.CSSProperties}>paper</span>{" "}
              <span className="sc-word sc-shimmer-text" style={{ ["--sc-wd" as string]: "360ms" } as React.CSSProperties}>again.</span>
            </h1>
            <p className="sc-rise sc-rise-3 mt-6 text-slate-500 text-lg sm:text-xl leading-relaxed max-w-md">
              One tap puts you in their phone. Then SwiftCard captures the lead, tracks it, and follows up for you — <span className="text-slate-800 font-semibold">so nobody forgets you</span>.
            </p>
            <div className="sc-rise sc-rise-4 mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/login?mode=signup" className="btn-cta bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-4 rounded-full text-[15px] text-center">
                Get your card — free
              </Link>
              <Link href="#demo" className="btn-cta border border-warm-card-border bg-warm-card hover:border-slate-400 text-slate-800 font-semibold px-8 py-4 rounded-full text-[15px] text-center">
                See your live dashboard
              </Link>
            </div>
            <div className="sc-rise sc-rise-4 mt-7 flex items-center gap-3 text-xs text-slate-400">
              <Stars size="w-3 h-3" />
              <span className="font-semibold text-slate-600">4.9/5</span>
              <span className="w-px h-3.5 bg-warm-border" />
              <span>Live in 30 seconds · no credit card</span>
            </div>
          </div>

          {/* The real card, held up like a photo — real template, real headshot */}
          <div className="relative flex justify-center sc-fade-in">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[300px] rounded-full pointer-events-none" style={{ background: "radial-gradient(closest-side, rgba(29,78,216,0.16), transparent)", filter: "blur(30px)" }} aria-hidden />
            <TiltCard max={6} className="w-full max-w-[430px]">
              <div className="sc-phone-bob rounded-3xl overflow-hidden shadow-[0_50px_90px_-30px_rgba(15,23,42,0.45)] border border-slate-200/70 bg-white rotate-[-2deg]">
                <PhotoFirst data={DEMO_CARD} />
              </div>
            </TiltCard>
            <div className="hidden md:block absolute -bottom-5 -left-2 sc-chip-float" aria-hidden>
              <div className="bg-white border border-warm-card-border rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">{I.check}</svg>
                </span>
                <div>
                  <p className="text-[12px] font-bold text-slate-900 leading-tight">Saved to contacts</p>
                  <p className="text-[10px] text-slate-400">one tap · nothing to download</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ TRUST STRIP ══ */}
      <div className="border-y border-warm-border bg-cream-dark py-4">
        <Marquee speed={30} className="sc-marquee-fade">
          {["Realtors", "Founders", "Recruiters", "Agents", "Photographers", "Consultants", "Brokers", "Designers", "Coaches", "Sales teams", "Barbers", "Creators"].map((p) => (
            <span key={p} className="flex items-center gap-3 px-6 text-[13px] font-semibold text-slate-400 whitespace-nowrap uppercase tracking-wider">
              <span className="w-1 h-1 rounded-full bg-brand/50" />
              {p}
            </span>
          ))}
        </Marquee>
      </div>

      {/* ══ NUMBERS ══ */}
      <section className="max-w-6xl mx-auto w-full px-5 sm:px-6 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { to: 88, suffix: "%", label: "of paper cards get tossed within a week. A digital card never does." },
            { to: 70, suffix: "%", label: "more follow-ups when saving your contact takes one tap." },
            { to: 30, suffix: "s", label: "from sign-up to a live card. Faster than finding a pen." },
          ].map((s, i) => (
            <div key={s.label} data-reveal style={{ transitionDelay: `${i * 90}ms` }} className="rounded-3xl bg-warm-card border border-warm-card-border p-8">
              <CountUpStat to={s.to} suffix={s.suffix} decimals={0} className="text-5xl font-bold text-slate-900 tabular-nums tracking-tight" />
              <p className="text-slate-500 text-[15px] mt-3 leading-relaxed">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ PRODUCT — dark canvas, real UI ══ */}
      <section id="product" className="px-3 sm:px-5 scroll-mt-28">
        <div className="max-w-[1200px] mx-auto rounded-[2.5rem] bg-[#0B1220] px-6 sm:px-12 py-20 overflow-hidden relative">
          <div className="absolute -top-40 left-1/3 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(29,78,216,0.22), transparent 65%)", filter: "blur(20px)" }} aria-hidden />

          <div className="relative max-w-2xl" data-reveal>
            <p className="text-[12px] font-bold tracking-[0.2em] text-blue-400 uppercase mb-4">More than a card</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-white leading-[1.05] tracking-tight">
              The card is the intro.<br />
              <span className="text-white/50">The follow-through is the product.</span>
            </h2>
          </div>

          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6 mt-14">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 sm:p-9" data-reveal>
              <h3 className="text-white font-bold text-xl mb-2">Every share becomes a lead</h3>
              <p className="text-white/50 text-[15px] leading-relaxed mb-7 max-w-sm">
                When someone shares their info back, they land in your contacts instantly — with their name, number, city, and how they found you. You get pinged the second it happens.
              </p>
              <div className="flex justify-center"><CrmVignette /></div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 sm:p-9" data-reveal style={{ transitionDelay: "100ms" }}>
              <h3 className="text-white font-bold text-xl mb-2">Follow-ups run themselves</h3>
              <p className="text-white/50 text-[15px] leading-relaxed mb-7 max-w-sm">
                Pick a cadence. AI writes personal emails and texts from how you actually met, signs them with your live card, and sends them on schedule. Leads stop going cold.
              </p>
              <div className="flex justify-center"><AutomationVignette /></div>
            </div>
          </div>

          <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {[
              { t: "5 designer templates", d: "or drag-and-drop your own" },
              { t: "Swift Links page", d: "link-in-bio for your socials" },
              { t: "Email signature", d: "your exact card, every email" },
              { t: "Analytics", d: "views, saves & top locations" },
            ].map((f, i) => (
              <div key={f.t} className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4" data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                <p className="text-white font-semibold text-[13.5px]">{f.t}</p>
                <p className="text-white/40 text-[12px] mt-0.5">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ WAYS TO SHARE ══ */}
      <section id="share" className="max-w-6xl mx-auto w-full px-5 sm:px-6 py-24 scroll-mt-28">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10" data-reveal>
          <div>
            <p className="text-[12px] font-bold tracking-[0.2em] text-brand uppercase mb-3">Ways to share</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-[1.05]">However you meet,<br />your card is there.</h2>
          </div>
          <p className="text-slate-400 text-sm sm:pb-2 lg:hidden">← swipe →</p>
        </div>
        <div className="sc-snap flex gap-4 overflow-x-auto pb-4 -mx-5 px-5 sm:mx-0 sm:px-0" data-reveal style={{ transitionDelay: "80ms" }}>
          {SHARE_WAYS.map((w) => (
            <div key={w.title} className="card-premium shrink-0 w-[250px] rounded-3xl bg-warm-card border border-warm-card-border p-7 hover:border-brand transition-colors">
              <div className="w-11 h-11 rounded-2xl bg-[#0B1220] text-white flex items-center justify-center mb-5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-5 h-5">{w.icon}</svg>
              </div>
              <p className="text-slate-900 font-bold text-[17px] mb-1.5">{w.title}</p>
              <p className="text-slate-500 text-sm leading-relaxed">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ LIVE DASHBOARD ══ */}
      <section id="demo" className="bg-gray-950 py-20 px-4 scroll-mt-28">
        <div className="max-w-5xl mx-auto text-center mb-8" data-reveal>
          <p className="text-[12px] font-bold tracking-[0.2em] text-blue-400 uppercase mb-4">Your live dashboard</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">Don&apos;t take our word for it.</h2>
          <p className="text-gray-400 mt-4 max-w-lg mx-auto text-[15px]">
            This is the real app with sample data — click anything. It&apos;s exactly what you get.
          </p>
        </div>
        <div data-reveal style={{ transitionDelay: "80ms" }}>
          <PreviewClient embedded />
        </div>
      </section>

      {/* ══ REVIEWS ══ */}
      <section id="reviews" className="py-24 overflow-hidden scroll-mt-28">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12" data-reveal>
          <div>
            <p className="text-[12px] font-bold tracking-[0.2em] text-brand uppercase mb-3">Reviews</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-[1.05]">People talk.<br />Let them.</h2>
          </div>
          <div className="flex items-center gap-2.5 sm:pb-2">
            <Stars />
            <span className="text-slate-700 font-bold text-sm">4.9/5 average rating</span>
          </div>
        </div>
        {[false, true].map((reverse, row) => (
          <Marquee key={row} speed={48} reverse={reverse} className={`sc-marquee-fade ${row === 0 ? "mb-4" : ""}`}>
            {REVIEWS.filter((_, i) => i % 2 === row).map((t) => (
              <figure key={t.name} className="w-[360px] shrink-0 mx-2 rounded-3xl bg-warm-card border border-warm-card-border p-7 flex flex-col shadow-sm">
                <blockquote className="text-slate-700 text-[15px] leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="mt-5 flex items-center justify-between">
                  <div>
                    <p className="text-slate-900 font-bold text-sm">{t.name}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{t.role}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: SOURCE_COLORS[t.source] }}>{t.source}</span>
                </figcaption>
              </figure>
            ))}
          </Marquee>
        ))}
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section className="max-w-6xl mx-auto w-full px-5 sm:px-6 pb-24">
        <div className="rounded-[2.5rem] bg-cream-dark border border-warm-border px-6 sm:px-12 py-16">
          <div className="max-w-xl mb-12" data-reveal>
            <p className="text-[12px] font-bold tracking-[0.2em] text-brand uppercase mb-3">How it works</p>
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight">Thirty seconds to your first share.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: "1", t: "Create", b: "Name, photo, links. Pick a template — you're live." },
              { n: "2", t: "Share", b: "Link, QR, NFC tap, signature, or your bio." },
              { n: "3", t: "Get saved", b: "One tap puts you in their phone. No app on their end." },
              { n: "4", t: "Follow up", b: "AI keeps the conversation alive so the lead never dies." },
            ].map((s, i) => (
              <div key={s.n} data-reveal style={{ transitionDelay: `${i * 90}ms` }} className="relative rounded-3xl bg-warm-card border border-warm-card-border p-7 pt-9">
                <span className="absolute -top-4 left-7 w-9 h-9 rounded-full bg-brand text-white text-[15px] font-black flex items-center justify-center shadow-lg shadow-blue-900/25">{s.n}</span>
                <p className="text-slate-900 font-bold text-lg">{s.t}</p>
                <p className="text-slate-500 text-sm leading-relaxed mt-1.5">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section className="max-w-6xl mx-auto w-full px-5 sm:px-6 pb-24 grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-10">
        <div data-reveal>
          <p className="text-[12px] font-bold tracking-[0.2em] text-brand uppercase mb-3">FAQ</p>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight leading-[1.05]">Questions?<br />Answers.</h2>
          <p className="text-slate-500 text-[15px] mt-4 max-w-xs">Anything else — <Link href="/contact" className="text-brand font-semibold hover:underline">talk to us</Link>. A human answers.</p>
        </div>
        <div data-reveal style={{ transitionDelay: "80ms" }}>
          <FAQAccordion faqs={FAQS} />
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section className="px-3 sm:px-5 pb-6">
        <div className="relative max-w-[1200px] mx-auto rounded-[2.5rem] overflow-hidden sc-gradient-move py-24 px-6" style={{ background: "linear-gradient(120deg, #1D4ED8 0%, #2745c9 45%, #4f46e5 100%)", backgroundSize: "200% 200%" }}>
          <div className="sc-glow-pulse absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.15), transparent 65%)" }} aria-hidden />
          <div className="relative max-w-2xl mx-auto text-center" data-reveal>
            <h2 className="text-4xl sm:text-6xl font-bold text-white tracking-tight leading-[1.02] mb-5">Be the one<br />they remember.</h2>
            <p className="text-white/70 text-lg mb-9">Your card, live in 30 seconds. Free to start.</p>
            <Link href="/login?mode=signup" className="btn-cta inline-block bg-white hover:bg-cream text-brand font-bold px-10 py-4 rounded-full text-[15px]">
              Get your card — free
            </Link>
            <p className="text-white/50 text-xs mt-6">4.9/5 rating · free forever plan · cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ══ FOOTER — multi-column ══ */}
      <footer className="border-t border-warm-border bg-cream py-14 px-5 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 sm:col-span-1">
              <SwiftCardLogo size={26} />
              <p className="text-slate-400 text-[13px] mt-4 leading-relaxed max-w-[220px]">The digital business card that captures leads and follows up for you.</p>
            </div>
            {[
              { h: "Product", links: [["See your live dashboard", "#demo"], ["Ways to share", "#share"], ["Pricing", "/pricing"], ["Try it live", "/preview"]] },
              { h: "Company", links: [["Contact", "/contact"], ["Reviews", "#reviews"], ["Sign in", "/login"], ["Get started", "/login?mode=signup"]] },
              { h: "Legal", links: [["Privacy policy", "/privacy"]] },
            ].map((col) => (
              <div key={col.h}>
                <p className="text-slate-900 font-bold text-[13px] uppercase tracking-wider mb-4">{col.h}</p>
                <ul className="space-y-2.5">
                  {col.links.map(([label, href]) => (
                    <li key={label}><Link href={href} className="text-slate-500 hover:text-slate-900 text-sm transition-colors">{label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-warm-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-slate-400 text-xs">© {new Date().getFullYear()} SwiftCard · New York, NY. All rights reserved.</p>
            <div className="flex items-center gap-2 text-xs text-slate-400"><Stars size="w-3 h-3" /> 4.9/5 from our users</div>
          </div>
        </div>
      </footer>
    </main>
  );
}
