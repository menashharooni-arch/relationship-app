import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollProgress from "@/components/ScrollProgress";

// COMPLIANCE NOTE (do not regress): this page previously showed fictional
// testimonials with fake star ratings and a fabricated review count. Under the
// FTC's Rule on the Use of Consumer Reviews and Testimonials (16 CFR Part 465,
// effective Oct 2024), testimonials from people who don't exist or who have no
// real experience with the product — and misrepresented ratings/metrics — are
// prohibited, with civil penalties per violation. Until we have REAL customer
// reviews (collected via /grow → Trustpilot), this page shows only truthful,
// verifiable claims about the product. Never add invented quotes, star ratings,
// review counts, or usage statistics here.

export const metadata: Metadata = {
  title: "Why SwiftCard — SwiftCard",
  description:
    "Why professionals are switching to digital business cards: share in one tap, capture every lead, and follow up automatically. Free to start.",
};

function A({ children }: { children: React.ReactNode }) {
  return <span className="rd-aurora-text">{children}</span>;
}

// Truthful, product-grounded use cases — written in the second person as
// marketing copy about what the product DOES, never framed as a quote from a
// customer. Every claim maps to a real shipped feature.
const USE_CASES: { role: string; title: string; body: string }[] = [
  {
    role: "Real estate",
    title: "Every open-house visitor, captured",
    body: "Show your QR at the door. Each scan opens your card, and anyone who shares their info lands in your dashboard — with automatic follow-up so no lead goes cold.",
  },
  {
    role: "Sales teams",
    title: "One brand, every rep in sync",
    body: "Office accounts put your whole team on matching cards. Update the brand kit once and every card changes; leads route to the rep who made the connection.",
  },
  {
    role: "Recruiters",
    title: "Stay top of mind after one meeting",
    body: "Set a follow-up cadence once. SwiftCard sends the emails and texts for you — each one signed with your live card.",
  },
  {
    role: "Creators & freelancers",
    title: "Portfolio, booking, socials — one link",
    body: "Your Swift Links page holds your bio, links, and socials in one place. Drop it in your Instagram or TikTok bio and let clients reach you from anywhere.",
  },
  {
    role: "Consultants",
    title: "Share from your phone, wallet, or watch",
    body: "Your card lives in Apple Wallet and on your wrist. Tap, scan, or text it — the other person needs no app to receive it.",
  },
  {
    role: "Anyone who networks",
    title: "See what's working",
    body: "Views, locations, and sources for your card and links — networking becomes something you can measure instead of guess at.",
  },
];

// Every fact here must stay literally true.
const FACTS = [
  { v: "Free", l: "to start — no credit card" },
  { v: "1 tap", l: "to share your card" },
  { v: "No app", l: "needed to receive it" },
  { v: "Cancel", l: "anytime, no lock-in" },
];

export default function WhySwiftCardPage() {
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
              <span className="rd-pill rd-pill-d"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--rd-aurora)" }} />Why SwiftCard</span>
            </div>
            <h1 className="rd-display text-white text-[clamp(2.3rem,5vw,3.8rem)] mt-6" data-reveal>
              Built for people who <A>never want to lose a lead.</A>
            </h1>
            <p className="text-white/60 text-[1.12rem] mt-5 leading-relaxed max-w-[640px] mx-auto" data-reveal>
              Paper cards get tossed. SwiftCard puts your card in their phone, their contact in your dashboard,
              and your follow-up on autopilot. Here&apos;s what that looks like for people like you.
            </p>
          </div>
        </section>

        {/* Use cases — truthful second-person scenarios, not testimonials */}
        <section className="rd-light relative py-24">
          <div className="max-w-6xl mx-auto px-5 sm:px-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {USE_CASES.map((u, i) => (
                <div key={u.role} className="rd-card-l p-6 flex flex-col" data-reveal style={{ transitionDelay: `${(i % 3) * 70}ms` }}>
                  <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-slate-500">{u.role}</p>
                  <p className="text-slate-900 font-semibold text-[16px] mt-3">{u.title}</p>
                  <p className="text-slate-600 text-[14.5px] leading-relaxed mt-2 flex-1">{u.body}</p>
                </div>
              ))}
            </div>

            {/* Honesty card — our credibility IS being straight with you */}
            <div className="rd-card-l p-8 sm:p-10 mt-6" data-reveal>
              <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-slate-500">A note on reviews</p>
              <p className="text-slate-800 text-[1.15rem] leading-relaxed font-medium mt-3" style={{ textWrap: "balance" }}>
                SwiftCard is new, and we don&apos;t publish reviews we don&apos;t have. No invented quotes, no made-up
                star ratings — when real customer reviews come in, you&apos;ll see them here, unedited.
              </p>
              <p className="text-slate-600 text-[14.5px] leading-relaxed mt-3">
                Using SwiftCard already? We&apos;d genuinely love your take — it helps more than you&apos;d think.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="https://www.trustpilot.com/evaluate/swiftcard.me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rd-btn rd-btn-aurora"
                >
                  Be one of our first reviewers →
                </a>
                <Link href="/cards/new" className="rd-btn rd-btn-ghost-l">Try it free first</Link>
              </div>
            </div>
          </div>
        </section>

        {/* Facts strip — literally-true claims only */}
        <section className="relative py-20" style={{ background: "var(--rd-ink-1000)" }}>
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              {FACTS.map((s) => (
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
            <h2 className="rd-h2 text-white text-[clamp(2rem,4.4vw,3.2rem)]" data-reveal>Try it yourself — it&apos;s free to start.</h2>
            <p className="text-white/60 text-[1.08rem] mt-4" data-reveal>Your free SwiftCard is 60 seconds away. Judge it on what it does.</p>
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
