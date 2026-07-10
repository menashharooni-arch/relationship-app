import Link from "next/link";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import HeroPhone from "@/components/HeroPhone";
import PreviewClient from "@/app/preview/PreviewClient";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollProgress from "@/components/ScrollProgress";
import MarketingNav from "@/components/MarketingNav";
import CountUpStat from "@/components/CountUpStat";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { Marquee, TiltCard, FAQAccordion, PhoneShell } from "@/components/home/HomeFX";

// ── Real product info (kept in sync with the live app) ──────────────────────

const PROFESSIONS = [
  "Realtors", "Founders", "Barbers", "Creators", "Recruiters", "Agents",
  "Photographers", "Consultants", "Brokers", "Designers", "Coaches", "Sales teams",
];

const SHARE_WAYS = [
  { emoji: "🔗", title: "One link", body: "Text it, DM it, drop it anywhere. Opens instantly in any browser." },
  { emoji: "📸", title: "QR code", body: "A real, scannable QR lives right on your card. Point, scan, saved." },
  { emoji: "📳", title: "NFC tap", body: "Write your link to any NFC card. Tap their phone — mind blown." },
  { emoji: "✉️", title: "Swift Signature", body: "Your live card in every email you send. Set it once, share forever." },
  { emoji: "🌐", title: "Swift Links", body: "A link-in-bio page for your Instagram or TikTok — same card, same leads." },
  { emoji: "📲", title: "Share sheet", body: "AirDrop it, text it, post it — anything your phone can share, your card can ride." },
];

const TESTIMONIALS = [
  { quote: "I handed out 200 paper cards at a conference and got zero follow-ups. With SwiftCard I closed 3 deals from one event.", name: "John Chicoine", role: "Commercial Real Estate Broker", initial: "JC", source: "LinkedIn" },
  { quote: "SwiftCard makes me look polished and my clients always comment on how easy it was to save my contact.", name: "Aaron Bennett", role: "Senior Mortgage Broker", initial: "AB", source: "App Store" },
  { quote: "The automated follow-up emails are a game changer. Leads reply days later saying they forgot about me — now they don't.", name: "Marcus Webb", role: "Startup Founder", initial: "MW", source: "G2" },
  { quote: "I replaced our entire team's paper cards with SwiftCard in one afternoon. The office dashboard shows each rep in real time.", name: "Priya Shankar", role: "VP of Marketing", initial: "PS", source: "LinkedIn" },
  { quote: "I tap my NFC card to someone's phone and they have my full card in seconds. Most impressive thing I do in meetings.", name: "Derek Fontaine", role: "Insurance Agent", initial: "DF", source: "App Store" },
  { quote: "Analytics showed 80% of my views came from Instagram. I doubled down on what was actually working.", name: "Stephanie Owens", role: "Independent Consultant", initial: "SO", source: "G2" },
];

const SOURCE_BADGE_COLORS: Record<string, string> = {
  LinkedIn: "#0A66C2",
  "App Store": "#007AFF",
  G2: "#FF492C",
};

const FAQS = [
  { q: "Does the person I share with need to download anything?", a: "No. Your card opens in any browser instantly. They can save your contact to their phone with one tap — no app, no account, no friction." },
  { q: "What happens when someone shares their info with me?", a: "They land in your built-in CRM instantly — name, email, phone, the message they wrote, even their location and which link they came from. You can add notes, track the conversation, and let AI draft your follow-up." },
  { q: "What is a Swift Links page?", a: "Every card comes with its own Swift Links page — a modern link-in-bio with your photo, bio, social icons, and custom buttons. Drop it in your Instagram, TikTok, or other social bios." },
  { q: "Can I put my card in my email signature?", a: "Yes — copy your live business card straight into your email signature in one click. It's a pixel-exact picture of your card, and it updates whenever your card does." },
  { q: "Can I use SwiftCard with NFC cards?", a: "Yes. Your card URL is NFC-ready out of the box. Write your SwiftCard link to any blank NFC card or sticker, and anyone who taps it sees your card instantly." },
  { q: "What's the difference between Free and Pro?", a: "Free gives you 1 card, 5 new leads a month, all 5 templates, unlimited Swift Links buttons, analytics with top locations, a Day-1 follow-up email, plus 3 AI drafts and 3 card scans a month. Pro removes the monthly limits, adds unlimited cards, the custom card designer, automated email + text follow-up sequences, full analytics, CSV export & integrations, and removes SwiftCard branding." },
  { q: "Can I cancel anytime?", a: "Yes. No contracts, no commitments. Cancel from your account at any time and you keep access until the end of your billing period." },
];

// ── Small in-phone mockups (pure JSX — always crisp, always on-brand) ───────

function MockCardScreen() {
  return (
    <div className="p-3 pt-10">
      <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="h-14 bg-gradient-to-r from-blue-600 to-blue-500" />
        <div className="px-3 pb-3">
          <div className="w-12 h-12 -mt-6 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border-[3px] border-white shadow flex items-center justify-center text-[11px] font-black text-blue-700">AM</div>
          <p className="mt-1 text-[12px] font-extrabold text-slate-900">Alex Morgan</p>
          <p className="text-[9px] text-slate-400">Founder & CEO · Morgan & Co.</p>
          <div className="mt-2 flex items-center justify-between">
            <div className="h-[16px] px-2.5 rounded-full bg-blue-600 flex items-center text-[7.5px] font-bold text-white">Save Contact</div>
            <div className="w-5 h-5 rounded bg-slate-900" />
          </div>
        </div>
      </div>
      <div className="mt-2 rounded-full bg-blue-600 text-white text-center text-[10px] font-bold py-2">Save Alex&apos;s contact</div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {["LinkedIn", "Instagram", "Website"].map((s) => (
          <div key={s} className="h-6 rounded-md border border-slate-200 bg-white text-[7.5px] font-bold text-slate-600 flex items-center justify-center">{s}</div>
        ))}
      </div>
      <div className="mt-2 rounded-xl bg-[#EDE5D8] border border-[#D4C8B8] p-2.5">
        <p className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Share your info with Alex</p>
        {["Full name", "Phone number"].map((p) => (
          <div key={p} className="h-6 mb-1 rounded-md bg-white border border-[#D4C8B8] flex items-center px-2 text-[8px] text-slate-400">{p}</div>
        ))}
        <div className="h-6 rounded-md bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center">Share my info →</div>
      </div>
    </div>
  );
}

function MockLeadsScreen() {
  const leads = [
    { n: "Sarah Kim", d: "Shared info · Instagram", t: "2m", unread: true },
    { n: "Mike Torres", d: "Saved your contact", t: "1h", unread: true },
    { n: "Dana Patel", d: "Viewed your card · NYC", t: "3h", unread: false },
    { n: "Chris Lowe", d: "Shared info · QR scan", t: "1d", unread: false },
  ];
  return (
    <div className="p-3 pt-10">
      <p className="text-[12px] font-extrabold text-slate-900 mb-0.5">Contacts</p>
      <p className="text-[8.5px] text-slate-400 mb-2.5">Every share becomes a lead — automatically</p>
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
        {leads.map((l) => (
          <div key={l.n} className="flex items-center gap-2 px-2.5 py-2">
            <div className={`w-1.5 h-1.5 rounded-full ${l.unread ? "bg-blue-600" : "bg-slate-200"}`} />
            <div className="w-6 h-6 rounded-full bg-blue-600/10 text-blue-700 text-[8px] font-bold flex items-center justify-center">{l.n.split(" ").map(x => x[0]).join("")}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[9.5px] font-bold text-slate-900 truncate">{l.n}</p>
              <p className="text-[7.5px] text-slate-400 truncate">{l.d}</p>
            </div>
            <span className="text-[7px] text-slate-300">{l.t}</span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2">
        <p className="text-[8px] font-bold text-emerald-700">✓ Day-1 follow-up sent to Sarah</p>
        <p className="text-[7px] text-emerald-600/70 mt-0.5">AI wrote it from your notes — sent as you</p>
      </div>
    </div>
  );
}

function MockAutomationScreen() {
  const steps = [
    { d: "Day 1", m: "Great meeting you at the expo — here's my card!", on: true },
    { d: "Day 14", m: "Checking in — how's the project going?", on: true },
    { d: "Day 28", m: "Circling back in case the timing is better now.", on: false },
  ];
  return (
    <div className="p-3 pt-10">
      <p className="text-[12px] font-extrabold text-slate-900 mb-0.5">Follow-ups on autopilot</p>
      <p className="text-[8.5px] text-slate-400 mb-2.5">AI writes it · SwiftCard sends it · you close it</p>
      <div className="flex gap-1.5 mb-2.5">
        {["Light", "Medium", "Aggressive"].map((p, i) => (
          <div key={p} className={`flex-1 h-7 rounded-lg text-[8px] font-bold flex items-center justify-center ${i === 1 ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>{p}</div>
        ))}
      </div>
      <div className="space-y-1.5">
        {steps.map((s) => (
          <div key={s.d} className="rounded-xl border border-slate-200 bg-white p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[7.5px] font-bold text-blue-700 bg-blue-600/10 rounded-full px-1.5 py-0.5">{s.d}</span>
              <span className={`w-6 h-3.5 rounded-full relative ${s.on ? "bg-blue-600" : "bg-slate-200"}`}>
                <span className={`absolute top-[2px] w-2.5 h-2.5 rounded-full bg-white ${s.on ? "right-[2px]" : "left-[2px]"}`} />
              </span>
            </div>
            <p className="text-[8.5px] text-slate-600 leading-snug">{s.m}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockLinksScreen() {
  return (
    <div className="pt-10 px-3 h-full" style={{ background: "#0b1220" }}>
      <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-[11px] font-black text-white">AM</div>
      <p className="text-center text-[11px] font-extrabold text-white mt-1.5">Alex Morgan</p>
      <p className="text-center text-[8px] text-white/50 mb-2.5">Founder & CEO · Morgan & Co.</p>
      <div className="flex justify-center gap-1.5 mb-2.5">
        {["in", "ig", "tt", "yt"].map((s) => (
          <div key={s} className="w-6 h-6 rounded-full bg-white/10 text-white/80 text-[7px] font-bold flex items-center justify-center uppercase">{s}</div>
        ))}
      </div>
      {["📅 Book a call", "🌐 Visit website", "⭐ Leave a review", "💼 View portfolio"].map((l) => (
        <div key={l} className="mb-1.5 h-8 rounded-xl bg-white text-slate-900 text-[9px] font-bold flex items-center justify-center">{l}</div>
      ))}
      <div className="mt-2 h-8 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">Connect with Alex</div>
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
      <MarketingNav />

      {/* ── HERO ── */}
      <section className="relative max-w-6xl mx-auto w-full px-6 pt-14 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
          <div className="sc-blob sc-blob-a" style={{ width: 380, height: 380, top: -90, left: -70, background: "radial-gradient(circle, rgba(29,78,216,0.16), transparent 70%)" }} />
          <div className="sc-blob sc-blob-b" style={{ width: 320, height: 320, top: 60, right: -50, background: "radial-gradient(circle, rgba(124,58,237,0.13), transparent 70%)" }} />
        </div>

        <div>
          <div className="sc-rise inline-flex items-center gap-2 border border-warm-border rounded-full px-4 py-1.5 text-xs text-slate-500 mb-7 bg-cream-dark">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Free to start — no credit card required
          </div>

          <h1 className="text-[3rem] sm:text-[3.6rem] font-bold text-slate-900 leading-[1.04] tracking-tight mb-5">
            <span className="sc-word" style={{ ["--sc-wd" as string]: "120ms" } as React.CSSProperties}>Paper</span>{" "}
            <span className="sc-word" style={{ ["--sc-wd" as string]: "175ms" } as React.CSSProperties}>cards</span>{" "}
            <span className="sc-word" style={{ ["--sc-wd" as string]: "230ms" } as React.CSSProperties}>get</span>{" "}
            <span className="sc-word" style={{ ["--sc-wd" as string]: "285ms" } as React.CSSProperties}>tossed.</span>
            <br />
            <span className="sc-word" style={{ ["--sc-wd" as string]: "380ms" } as React.CSSProperties}>You</span>{" "}
            <span className="sc-word" style={{ ["--sc-wd" as string]: "435ms" } as React.CSSProperties}>get</span>{" "}
            <span className="sc-word sc-shimmer-text" style={{ ["--sc-wd" as string]: "490ms" } as React.CSSProperties}>saved.</span>
          </h1>

          <p className="sc-rise sc-rise-3 text-slate-500 text-lg leading-relaxed mb-7 max-w-md">
            The digital business card people save in <strong className="text-slate-700">one tap</strong> — then SwiftCard turns every share into a lead and follows up for you.
          </p>

          <div className="sc-rise sc-rise-4 flex flex-col sm:flex-row gap-3">
            <Link href="/login?mode=signup" className="btn-cta bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-4 rounded-full text-sm text-center">
              Create my free card
            </Link>
            <Link href="#demo" className="btn-cta border border-warm-card-border hover:border-slate-400 text-slate-700 hover:text-slate-900 font-semibold px-8 py-4 rounded-full text-sm text-center bg-warm-card">
              Try the live demo →
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
            <span>Live in 30 seconds — no design skills needed</span>
          </div>
        </div>

        {/* Phone + floating proof chips */}
        <div className="relative">
          <HeroPhone />
          <div className="hidden lg:block absolute top-10 -left-4 sc-chip-float" aria-hidden>
            <div className="bg-white border border-warm-card-border rounded-2xl shadow-lg px-3.5 py-2.5 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-[13px]">✓</span>
              <div>
                <p className="text-[11px] font-bold text-slate-900 leading-tight">Contact saved</p>
                <p className="text-[9px] text-slate-400">one tap · no app</p>
              </div>
            </div>
          </div>
          <div className="hidden lg:block absolute bottom-16 -right-2 sc-chip-float" style={{ animationDelay: "1.2s" }} aria-hidden>
            <div className="bg-white border border-warm-card-border rounded-2xl shadow-lg px-3.5 py-2.5 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[13px]">⚡</span>
              <div>
                <p className="text-[11px] font-bold text-slate-900 leading-tight">New lead: Sarah K.</p>
                <p className="text-[9px] text-slate-400">follow-up scheduled</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROFESSIONS MARQUEE ── */}
      <div className="border-y border-warm-border bg-cream-dark py-5">
        <Marquee speed={28} className="sc-marquee-fade">
          {PROFESSIONS.map((p) => (
            <span key={p} className="flex items-center gap-3 px-5 text-sm font-semibold text-slate-400 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-brand/40" />
              {p} love SwiftCard
            </span>
          ))}
        </Marquee>
      </div>

      {/* ── STATS ── */}
      <div className="bg-cream py-16 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { to: 88, suffix: "%", label: "of paper cards are tossed within a week — a digital card never is" },
            { to: 70, suffix: "%", label: "more follow-ups when people can save your contact instantly" },
            { to: 1, suffix: " tap", label: "to save your card to their phone — no app, no typing" },
          ].map((s, i) => (
            <div key={s.label} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <CountUpStat to={s.to} suffix={s.suffix} decimals={0} className="text-4xl sm:text-5xl font-bold text-slate-900 mb-1 tabular-nums" />
              <p className="text-slate-500 text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURE SHOWCASE 1: The card ── */}
      <section className="border-t border-warm-border bg-cream-dark py-24 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div data-reveal>
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">Your SwiftCard</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-4">A first impression they can&apos;t forget — or lose.</h2>
            <p className="text-slate-500 leading-relaxed mb-6">
              Your photo, your brand, every way to reach you — on a card that opens in any browser and saves to their phone in one tap. Five designer templates, or build your own with drag-and-drop.
            </p>
            <ul className="space-y-2.5">
              {["One tap saves you to their contacts", "Real scannable QR built into the card", "Update it anytime — everyone always sees the latest"].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 20 20" fill="#1D4ED8" className="w-3 h-3"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.79 6.8-6.79a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                  </span>
                  <span className="text-slate-700 text-[15px]">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center" data-reveal style={{ transitionDelay: "120ms" }}>
            <TiltCard><PhoneShell><MockCardScreen /></PhoneShell></TiltCard>
          </div>
        </div>
      </section>

      {/* ── FEATURE SHOWCASE 2: Leads (reversed) ── */}
      <section className="border-t border-warm-border bg-cream py-24 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div className="flex justify-center order-2 lg:order-1" data-reveal style={{ transitionDelay: "120ms" }}>
            <TiltCard><PhoneShell><MockLeadsScreen /></PhoneShell></TiltCard>
          </div>
          <div className="order-1 lg:order-2" data-reveal>
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">Built-in CRM</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-4">Every share becomes a lead. Automatically.</h2>
            <p className="text-slate-500 leading-relaxed mb-6">
              When someone shares their info back, they land in your contacts instantly — name, phone, email, where they found you, even their city. You get a notification and an email the second it happens.
            </p>
            <ul className="space-y-2.5">
              {["Notes, status, and full conversation history", "See who viewed, saved, and shared — and from where", "Push leads to Zapier or Google Contacts"].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 20 20" fill="#1D4ED8" className="w-3 h-3"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.79 6.8-6.79a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                  </span>
                  <span className="text-slate-700 text-[15px]">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FEATURE SHOWCASE 3: Automations ── */}
      <section className="border-t border-warm-border bg-cream-dark py-24 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div data-reveal>
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">AI follow-ups</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-4">You meet them once. SwiftCard never lets them forget you.</h2>
            <p className="text-slate-500 leading-relaxed mb-6">
              Pick a cadence — Light, Medium, or Aggressive — and AI writes personal follow-up emails and texts from your notes, signed with your live card. They go out automatically. Leads stop going cold.
            </p>
            <ul className="space-y-2.5">
              {["AI writes each message from how you actually met", "Email + text sequences run separately, on autopilot", "Every send is signed with your Swift Signature card"].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 20 20" fill="#1D4ED8" className="w-3 h-3"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.79 6.8-6.79a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                  </span>
                  <span className="text-slate-700 text-[15px]">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center" data-reveal style={{ transitionDelay: "120ms" }}>
            <TiltCard><PhoneShell><MockAutomationScreen /></PhoneShell></TiltCard>
          </div>
        </div>
      </section>

      {/* ── FEATURE SHOWCASE 4: Swift Links (reversed) ── */}
      <section className="border-t border-warm-border bg-cream py-24 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div className="flex justify-center order-2 lg:order-1" data-reveal style={{ transitionDelay: "120ms" }}>
            <TiltCard><PhoneShell><MockLinksScreen /></PhoneShell></TiltCard>
          </div>
          <div className="order-1 lg:order-2" data-reveal>
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">Swift Links</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-4">One link for everything you are.</h2>
            <p className="text-slate-500 leading-relaxed mb-6">
              Every card comes with a link-in-bio page — your bio, socials, and buttons in one place. Drop it in your Instagram or TikTok bio, and it captures leads just like your card does.
            </p>
            <ul className="space-y-2.5">
              {["Unlimited link buttons on every plan", "Same lead capture as your card", "Views and locations show up in your traffic"].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 20 20" fill="#1D4ED8" className="w-3 h-3"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.79 6.8-6.79a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                  </span>
                  <span className="text-slate-700 text-[15px]">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── SHARE WAYS CAROUSEL ── */}
      <section className="border-t border-warm-border bg-cream-dark py-24 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 mb-10" data-reveal>
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">Share your way</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Six ways to share. Zero friction.</h2>
        </div>
        <div className="sc-snap flex gap-4 overflow-x-auto px-6 pb-4 max-w-6xl mx-auto" data-reveal style={{ transitionDelay: "100ms" }}>
          {SHARE_WAYS.map((w) => (
            <div key={w.title} className="card-premium shrink-0 w-[240px] bg-warm-card border border-warm-card-border rounded-2xl p-6 hover:border-brand transition-colors">
              <div className="text-3xl mb-4">{w.emoji}</div>
              <p className="text-slate-900 font-bold text-base mb-1.5">{w.title}</p>
              <p className="text-slate-500 text-sm leading-relaxed">{w.body}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-slate-400 text-xs mt-2 lg:hidden">← swipe →</p>
      </section>

      {/* ── LIVE DEMO (dark) ── */}
      <section id="demo" className="bg-gray-950 py-20 px-4 scroll-mt-16">
        <div className="max-w-5xl mx-auto text-center mb-8" data-reveal>
          <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase mb-3">See it live</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Don&apos;t take our word for it. Click around.</h2>
          <p className="text-gray-400 mt-3 max-w-lg mx-auto text-sm">
            This is the real app with sample data — the exact dashboard you get.
          </p>
        </div>
        <div data-reveal style={{ transitionDelay: "80ms" }}>
          <PreviewClient embedded />
        </div>
      </section>

      {/* ── TESTIMONIAL MARQUEES ── */}
      <section className="border-t border-warm-border bg-cream py-24 overflow-hidden">
        <div className="text-center mb-12 px-6" data-reveal>
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">Testimonials</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">People talk. Let them.</h2>
        </div>
        {[false, true].map((reverse, row) => (
          <Marquee key={row} speed={46} reverse={reverse} className={`sc-marquee-fade ${row === 0 ? "mb-4" : ""}`}>
            {TESTIMONIALS.filter((_, i) => i % 2 === row).map((t) => (
              <div key={t.name} className="w-[340px] shrink-0 mx-2 bg-warm-card border border-warm-card-border rounded-2xl p-6 flex flex-col shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} viewBox="0 0 20 20" fill="#d97706" className="w-3.5 h-3.5"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: SOURCE_BADGE_COLORS[t.source] }}>{t.source}</span>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed flex-1 mb-5">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: "#1D4ED8" }}>{t.initial}</div>
                  <div>
                    <p className="text-slate-900 font-semibold text-sm leading-tight">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </Marquee>
        ))}
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="border-t border-warm-border py-24 px-6 bg-cream-dark">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14" data-reveal>
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Three steps. Thirty seconds.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { n: "01", t: "Make your card", b: "Name, photo, links — pick a template and you're live. No design skills." },
              { n: "02", t: "Share it anywhere", b: "Link, QR, NFC tap, email signature, or your bio. Nothing to download on their end." },
              { n: "03", t: "Watch leads roll in", b: "Every share becomes a contact, and AI follow-ups keep the conversation alive." },
            ].map((s, i) => (
              <div key={s.n} className="card-premium bg-warm-card border border-warm-card-border rounded-2xl p-7 relative" data-reveal style={{ transitionDelay: `${i * 110}ms` }}>
                <span className="absolute -top-4 left-6 w-9 h-9 rounded-xl bg-brand text-white text-sm font-black flex items-center justify-center shadow-lg shadow-blue-900/20">{s.n.slice(1)}</span>
                <h3 className="text-slate-900 font-bold text-base mt-4 mb-2">{s.t}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ (accordion) ── */}
      <section className="border-t border-warm-border bg-cream py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12" data-reveal>
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Questions? Answers.</h2>
          </div>
          <div data-reveal style={{ transitionDelay: "80ms" }}>
            <FAQAccordion faqs={FAQS} />
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative sc-gradient-move py-28 px-6 overflow-hidden" style={{ background: "linear-gradient(120deg, #1D4ED8 0%, #2745c9 45%, #4f46e5 100%)", backgroundSize: "200% 200%" }}>
        <div className="sc-glow-pulse absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14), transparent 65%)" }} aria-hidden />
        <div className="max-w-xl mx-auto text-center relative" data-reveal>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">Be the one they remember.</h2>
          <p className="text-white/70 mb-9 text-lg">Your card, live in 30 seconds. Free to start — no credit card.</p>
          <Link href="/login?mode=signup" className="btn-cta inline-block bg-white hover:bg-cream text-brand font-bold px-9 py-4 rounded-full text-sm">
            Create my free card →
          </Link>
          <p className="text-white/50 text-xs mt-5">4.9/5 rating · free forever plan · cancel anytime</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
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
          </div>
          <p className="text-slate-400 text-xs">© {new Date().getFullYear()} SwiftCard · New York, NY. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
