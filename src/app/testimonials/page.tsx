import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollProgress from "@/components/ScrollProgress";

export const metadata: Metadata = {
  title: "Testimonials — SwiftCard",
  description: "See why thousands of professionals switched to SwiftCard — real stories about sharing faster, capturing every lead, and following up on autopilot.",
};

function A({ children }: { children: React.ReactNode }) {
  return <span className="rd-aurora-text">{children}</span>;
}

function Stars({ n = 5, className = "" }: { n?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`} aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="w-4 h-4" fill={i < n ? "#F5A623" : "rgba(120,120,120,0.3)"}>
          <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2 5.06 16.8l.94-5.5-4-3.9 5.53-.8L10 1.6z" />
        </svg>
      ))}
    </div>
  );
}

const AVATAR_BG = [
  "linear-gradient(135deg,#1d4ed8,#4338ca)",
  "linear-gradient(135deg,#0e7490,#2563eb)",
  "linear-gradient(135deg,#7c3aed,#db2777)",
  "linear-gradient(135deg,#0f766e,#059669)",
  "linear-gradient(135deg,#b45309,#d97706)",
  "linear-gradient(135deg,#be123c,#e11d48)",
  "linear-gradient(135deg,#4f46e5,#7c3aed)",
  "linear-gradient(135deg,#0891b2,#0e7490)",
  "linear-gradient(135deg,#475569,#1e293b)",
];

type Review = { name: string; role: string; initials: string; quote: string; stars?: number };

// Fictional testimonials for the marketing site.
const FEATURED: Review = {
  name: "Jordan Ellis",
  role: "Real Estate Agent · Compass",
  initials: "JE",
  quote:
    "I used to hand out 200 paper cards at every open house and hear back from maybe two people. With SwiftCard, every scan lands in my dashboard and the follow-up email goes out on its own. I closed three deals last quarter from leads I'd have completely lost. It has quietly become the most valuable tool in my business.",
};

const REVIEWS: Review[] = [
  {
    name: "Mara Whitfield",
    role: "Founder · Loop Studio",
    initials: "MW",
    quote:
      "The Apple Wallet card is the thing people can't believe. I tap my phone, my whole profile drops into theirs, and there's nothing to download. It feels like magic every single time.",
  },
  {
    name: "Devin Park",
    role: "Sales Director · Northgate",
    initials: "DP",
    quote:
      "We rolled SwiftCard out to a 40-person sales team in an afternoon. One brand, everyone's cards in sync, and I can finally see which reps are actually networking. A real change for our pipeline.",
  },
  {
    name: "Priya Raman",
    role: "Recruiter · TalentForge",
    initials: "PR",
    quote:
      "Half my job is meeting someone once and staying top of mind. The automatic follow-up with my card attached does that for me while I sleep. My reply rate basically doubled.",
  },
  {
    name: "Carlos Mendes",
    role: "Photographer",
    initials: "CM",
    quote:
      "My SwiftLink is my portfolio, booking link, and socials in one beautiful page that lives in my Instagram bio. Clients book straight from it. I haven't printed a card in over a year.",
  },
  {
    name: "Alicia Grant",
    role: "Financial Advisor",
    initials: "AG",
    quote:
      "Clients trust polish. Handing someone a beautiful card that saves straight to their phone — with my headshot and every detail — makes me look like the firm I want to be.",
    stars: 5,
  },
  {
    name: "Tomás Herrera",
    role: "Independent Consultant",
    initials: "TH",
    quote:
      "I was skeptical a 'digital card' would matter. Then I watched a prospect save my contact in one tap at a conference and text me an hour later. Completely sold.",
  },
  {
    name: "Nina Kovač",
    role: "Marketing Lead · Brightpath",
    initials: "NK",
    quote:
      "The analytics are the part nobody talks about. I can see who viewed my card, from where, and when. It turned networking from a guessing game into something I can actually measure.",
  },
  {
    name: "Sam Okafor",
    role: "Startup Founder",
    initials: "SO",
    quote:
      "Cheapest, highest-ROI tool in my stack. Free to start, and the leads it's captured have paid for the Pro plan a hundred times over.",
  },
  {
    name: "Rachel Bloom",
    role: "Account Executive · Vanta",
    initials: "RB",
    quote:
      "At a trade show I shared my card 90 times in two days without touching a stack of paper. Every one of those contacts was waiting in my CRM by the time I got home.",
  },
];

const STATS = [
  { v: "4.9★", l: "Average rating" },
  { v: "12,000+", l: "Professionals" },
  { v: "1.4M", l: "Contacts shared" },
  { v: "98%", l: "Would recommend" },
];

export default function TestimonialsPage() {
  return (
    <div className="rd-dark2">
      <ScrollProgress />
      <div className="sc-scroll-progress" />
      <ScrollReveal />
      <SiteNav />

      <main className="overflow-clip">
        {/* Hero */}
        <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-20">
          <div className="rd-grid absolute inset-0 opacity-40" />
          <div className="rd-glow rd-glow-violet rd-drift-a" style={{ width: 520, height: 520, left: "-8%", top: "-14%" }} />
          <div className="rd-glow rd-glow-cyan rd-drift-b" style={{ width: 380, height: 380, right: "-6%", top: "6%", opacity: 0.3 }} />

          <div className="relative max-w-4xl mx-auto px-5 sm:px-6 text-center">
            <div data-reveal="fade" className="flex justify-center">
              <span className="rd-pill rd-pill-d"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--rd-aurora)" }} />Testimonials</span>
            </div>
            <h1 className="rd-display text-white text-[clamp(2.3rem,5vw,3.8rem)] mt-6" data-reveal>
              Loved by people who <A>never lose a lead.</A>
            </h1>
            <p className="text-white/60 text-[1.12rem] mt-5 leading-relaxed max-w-[640px] mx-auto" data-reveal>
              Realtors, recruiters, founders, and sales teams switched to SwiftCard to share faster and follow up automatically. Here&apos;s what they told us.
            </p>
            <div className="mt-7 flex flex-col items-center gap-2" data-reveal>
              <Stars n={5} className="scale-125" />
              <p className="text-white/55 text-[14px]">4.9 out of 5 — based on 2,347 reviews</p>
            </div>
          </div>
        </section>

        {/* Reviews */}
        <section className="rd-light relative py-24">
          <div className="max-w-6xl mx-auto px-5 sm:px-6">
            {/* Featured review */}
            <div className="rd-card-l p-8 sm:p-10 mb-6" data-reveal>
              <Stars n={5} />
              <p className="text-slate-800 text-[1.35rem] sm:text-[1.5rem] leading-snug font-medium mt-5" style={{ textWrap: "balance" }}>
                &ldquo;{FEATURED.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3.5 mt-7">
                <span className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[15px] shrink-0" style={{ background: AVATAR_BG[0] }}>{FEATURED.initials}</span>
                <div>
                  <p className="text-slate-900 font-semibold text-[15px]">{FEATURED.name}</p>
                  <p className="text-slate-500 text-[13px]">{FEATURED.role}</p>
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {REVIEWS.map((r, i) => (
                <div key={r.name} className="rd-card-l p-6 flex flex-col" data-reveal style={{ transitionDelay: `${(i % 3) * 70}ms` }}>
                  <Stars n={r.stars ?? 5} />
                  <p className="text-slate-600 text-[14.5px] leading-relaxed mt-4 flex-1">&ldquo;{r.quote}&rdquo;</p>
                  <div className="flex items-center gap-3 mt-6">
                    <span className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[13px] shrink-0" style={{ background: AVATAR_BG[(i + 1) % AVATAR_BG.length] }}>{r.initials}</span>
                    <div className="min-w-0">
                      <p className="text-slate-900 font-semibold text-[14px] truncate">{r.name}</p>
                      <p className="text-slate-500 text-[12.5px] truncate">{r.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="relative py-20" style={{ background: "var(--rd-ink-1000)" }}>
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              {STATS.map((s) => (
                <div key={s.l} className="text-center" data-reveal>
                  <p className="rd-aurora-text text-[clamp(2rem,4vw,2.8rem)] font-extrabold leading-none">{s.v}</p>
                  <p className="text-white/50 text-[13.5px] mt-2">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative py-24 overflow-hidden" style={{ background: "var(--rd-ink-1000)" }}>
          <div className="absolute inset-0 opacity-90" style={{ background: "radial-gradient(80% 120% at 50% 120%, rgba(93,107,255,0.32), transparent 60%)" }} />
          <div className="relative max-w-2xl mx-auto px-5 sm:px-6 text-center">
            <h2 className="rd-h2 text-white text-[clamp(2rem,4.4vw,3.2rem)]" data-reveal>Join them — it&apos;s free to start.</h2>
            <p className="text-white/60 text-[1.08rem] mt-4" data-reveal>Your free SwiftCard is a minute away.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3" data-reveal>
              <Link href="/cards/new" className="rd-btn rd-btn-aurora rd-btn-lg">Create your free card</Link>
              <Link href="/pricing" className="rd-btn rd-btn-ghost-d rd-btn-lg">See pricing</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
