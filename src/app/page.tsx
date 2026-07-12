import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollProgress from "@/components/ScrollProgress";
import HeroImage from "@/components/site/HeroImage";
import SwiftLinksPhone from "@/components/site/SwiftLinksPhone";
import SignatureDemo from "@/components/site/SignatureDemo";
import DashboardDemo from "@/components/site/DashboardDemo";
import ShareWaysPhones from "@/components/site/ShareWaysPhones";
import WatchScene from "@/components/site/WatchScene";
import TemplateGallery from "@/components/site/TemplateGallery";

export const metadata: Metadata = {
  title: "SwiftCard — The digital business card that shares itself",
  description:
    "One tap and you're in their phone — card, links, and everything you do. Digital cards, SwiftLinks, live email signatures, Apple Wallet, analytics, and lead capture.",
};

function Eyebrow({ children, dark = true }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span className={`rd-pill ${dark ? "rd-pill-d" : "rd-pill-l"}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--rd-aurora)" }} />
      {children}
    </span>
  );
}

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <ScrollReveal />
      <SiteNav />

      <main className="overflow-clip">
        {/* ═══════════════ HERO ═══════════════ */}
        <section className="rd-dark2 relative pt-32 pb-24 sm:pt-40 sm:pb-32">
          <div className="rd-grid absolute inset-0 opacity-[0.5]" />
          <div className="rd-glow rd-glow-violet rd-drift-a" style={{ width: 560, height: 560, left: "-8%", top: "-14%" }} />
          <div className="rd-glow rd-glow-blue rd-drift-b" style={{ width: 460, height: 460, right: "-6%", top: "4%", opacity: 0.4 }} />

          <div className="relative max-w-7xl mx-auto px-5 sm:px-6 grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
            <div>
              <div data-reveal="fade">
                <span className="rd-green-badge">
                  <span className="rd-green-dot" />
                  Free to start — no credit card required
                </span>
              </div>
              <h1 className="rd-display text-white mt-6 text-[clamp(2.7rem,6.4vw,5.1rem)]" data-reveal>
                The business card that{" "}
                <span className="rd-aurora-text rd-aurora-anim">shares everything</span>
              </h1>
              <ul className="mt-7 space-y-3.5 max-w-[560px]" data-reveal>
                {[
                  "Share by link, QR code, or NFC tap",
                  "They save you in one tap — nothing to download",
                  "Every share becomes a lead + automatic follow-up",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-white/75 text-[clamp(1rem,1.4vw,1.15rem)] leading-snug">
                    <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(37,99,235,0.16)" }}>
                      <svg viewBox="0 0 20 20" className="w-3 h-3 text-sky-300" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4L8.5 12l6.8-6.7a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-9 flex flex-wrap items-center gap-3" data-reveal>
                <Link href="/cards/new" className="rd-btn rd-btn-aurora rd-btn-lg">Create your free card</Link>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end" data-reveal="scale">
              <HeroImage />
            </div>
          </div>
        </section>

        {/* ═══════════════ HOW IT WORKS ═══════════════ */}
        <section className="rd-dark relative py-20 border-y border-white/8">
          <div className="max-w-7xl mx-auto px-5 sm:px-6">
            <div className="rd-steps">
              <div className="rd-steps-line" aria-hidden="true" />
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { n: "01", t: "Share in one tap", d: "Tap a phone, show your QR, or drop your link. Your card opens instantly — no app, no friction." },
                  { n: "02", t: "They save you", d: "Your name, number, email and photo land in their contacts. You share theirs back, too." },
                  { n: "03", t: "You see everything", d: "Every view, save, and location — in a dashboard built to turn moments into relationships." },
                ].map((s, i) => (
                  <div key={s.n} className="rd-step rd-glass p-6" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                    <span className="rd-step-num rd-aurora-text text-[15px] font-bold tracking-widest">{s.n}</span>
                    <p className="text-white font-semibold text-[19px] mt-3">{s.t}</p>
                    <p className="text-white/50 text-[14.5px] mt-2 leading-relaxed">{s.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ DIGITAL CARDS ═══════════════ */}
        <section id="cards" className="rd-light relative py-24 sm:py-28">
          <div className="max-w-7xl mx-auto px-5 sm:px-6">
            <div className="max-w-2xl" data-reveal>
              <Eyebrow dark={false}>Digital Cards</Eyebrow>
              <h2 className="rd-h2 text-[clamp(2rem,4.2vw,3.3rem)] text-slate-900 mt-5">
                A card so good, people <span className="rd-aurora-text">want</span> to keep it.
              </h2>
              <p className="text-slate-500 text-[1.1rem] mt-4 leading-relaxed">
                Designer templates, your colors, your photo, your logo — a scannable QR and a Save Contact button built in. It looks like you spent a fortune. You spent a minute.
              </p>
            </div>

            <div className="mt-14" data-reveal>
              <TemplateGallery />
            </div>
          </div>
        </section>

        {/* ═══════════════ SWIFTLINKS ═══════════════ */}
        <section id="swiftlinks" className="rd-dark relative py-24 sm:py-28 overflow-hidden">
          <div className="rd-glow rd-glow-cyan rd-drift-b" style={{ width: 420, height: 420, right: "-8%", top: "10%", opacity: 0.3 }} />
          <div className="max-w-7xl mx-auto px-5 sm:px-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
            <div>
              <div data-reveal><Eyebrow>SwiftLinks</Eyebrow></div>
              <h2 className="rd-h2 text-[clamp(2rem,4.2vw,3.3rem)] text-white mt-5" data-reveal>
                Everything to do. <span className="rd-aurora-text">One SwiftLink.</span>
              </h2>
              <p className="text-white/55 text-[1.1rem] mt-4 leading-relaxed" data-reveal>
                Your bio, your socials, your booking link, your latest drop — one beautiful page that lives in your Instagram, TikTok, or email. Separate from your card, powered by the same profile.
              </p>
              <ul className="mt-7 space-y-3.5" data-reveal>
                {[
                  "Unlimited links and social buttons",
                  "Capture leads right from your page",
                  "Matches your brand, updates in real time",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3 text-white/75 text-[15px]">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(37,99,235,0.14)" }}>
                      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 text-sky-300" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4L8.5 12l6.8-6.7a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center" data-reveal="scale">
              <SwiftLinksPhone />
            </div>
          </div>
        </section>

        {/* ═══════════════ EMAIL SIGNATURE ═══════════════ */}
        <section id="signature" className="rd-light2 relative py-24 sm:py-28">
          <div className="max-w-7xl mx-auto px-5 sm:px-6">
            <div className="max-w-2xl mb-12" data-reveal>
              <Eyebrow dark={false}>Email Signatures</Eyebrow>
              <h2 className="rd-h2 text-[clamp(2rem,4.2vw,3.3rem)] text-slate-900 mt-5">
                Every email you send, <span className="rd-aurora-text">advertising you.</span>
              </h2>
              <p className="text-slate-500 text-[1.1rem] mt-4 leading-relaxed">
                Drop your live SwiftCard into your signature once. Now every message ends with a clickable card — recipients open it, save your contact, and reach out in a single tap.
              </p>
            </div>
            <div data-reveal="fade"><SignatureDemo /></div>
          </div>
        </section>

        {/* ═══════════════ ANALYTICS / DASHBOARD ═══════════════ */}
        <section id="analytics" className="rd-dark2 relative py-24 sm:py-28 overflow-hidden">
          <div className="rd-grid absolute inset-0 opacity-40" />
          <div className="rd-glow rd-glow-violet rd-drift-a" style={{ width: 480, height: 480, left: "-10%", bottom: "-20%", opacity: 0.3 }} />
          <div className="relative max-w-7xl mx-auto px-5 sm:px-6">
            <div className="max-w-2xl mb-12" data-reveal>
              <Eyebrow>Dashboard & Analytics</Eyebrow>
              <h2 className="rd-h2 text-[clamp(2rem,4.2vw,3.3rem)] text-white mt-5">
                See who&apos;s looking. <span className="rd-aurora-text">Never lose a lead.</span>
              </h2>
              <p className="text-white/55 text-[1.1rem] mt-4 leading-relaxed">
                Real-time views, saves, and locations. Every contact who taps your card lands in one place — searchable, with the full history and automated follow-ups. Try the dashboard right here.
              </p>
            </div>
            <div data-reveal="fade"><DashboardDemo /></div>
          </div>
        </section>

        {/* ═══════════════ APPLE WALLET ═══════════════ */}
        <section id="wallet" className="rd-dark relative py-24 sm:py-28 border-y border-white/8 overflow-hidden">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 grid lg:grid-cols-[0.85fr_1.15fr] gap-14 items-center">
            <div>
              <div data-reveal><Eyebrow>Ways to share</Eyebrow></div>
              <h2 className="rd-h2 text-[clamp(2rem,4.2vw,3.3rem)] text-white mt-5" data-reveal>
                Your card, always <span className="rd-aurora-text">in your pocket.</span>
              </h2>
              <p className="text-white/55 text-[1.1rem] mt-4 leading-relaxed" data-reveal>
                However you meet someone, there&apos;s a way to hand them your card in a second — no app, no signal, no fumbling.
              </p>
              <ul className="mt-7 space-y-3.5" data-reveal>
                {[
                  "Apple Wallet — a swipe away, next to your passes",
                  "QR code — they scan, your card opens instantly",
                  "Share sheet — text, email, AirDrop, or any app",
                  "NFC tap, a link, or your email signature",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-white/75 text-[15px] leading-snug">
                    <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(37,99,235,0.16)" }}>
                      <svg viewBox="0 0 20 20" className="w-3 h-3 text-sky-300" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4L8.5 12l6.8-6.7a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-7" data-reveal>
                <Link href="/cards/new" className="rd-btn rd-btn-primary">Add SwiftCard to Wallet</Link>
              </div>
            </div>
            <div className="flex justify-center" data-reveal="scale"><ShareWaysPhones /></div>
          </div>
        </section>

        {/* ═══════════════ APPLE WATCH ═══════════════ */}
        <section id="watch" className="rd-light relative py-24 sm:py-28">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 grid lg:grid-cols-2 gap-14 items-center">
            <div className="flex justify-center order-2 lg:order-1" data-reveal="scale"><WatchScene /></div>
            <div className="order-1 lg:order-2">
              <div data-reveal><Eyebrow dark={false}>Apple Watch</Eyebrow></div>
              <h2 className="rd-h2 text-[clamp(1.9rem,4vw,3rem)] text-slate-900 mt-5" data-reveal>
                Make your Apple Watch into a <span className="rd-aurora-text">tappable business card</span> you take with you everywhere.
              </h2>
              <p className="text-slate-500 text-[1.1rem] mt-4 leading-relaxed" data-reveal>
                Raise your wrist, show your code, and share your details hands-free — no phone required. Your card goes wherever you go.
              </p>
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 max-w-[440px]" data-reveal="fade">
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="#5D6BFF" strokeWidth={1.8}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" strokeLinecap="round" /></svg>
                <p className="text-slate-500 text-[13.5px] leading-relaxed">
                  <span className="font-semibold text-slate-700">On the roadmap.</span> Today you can add your card to Apple Wallet and reach it from your Watch. A dedicated native watchOS app is in development — we&apos;ll only ship it once it&apos;s fully approved by Apple.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ TEAMS ═══════════════ */}
        <section id="teams" className="rd-dark2 relative py-24 sm:py-28 overflow-hidden">
          <div className="rd-glow rd-glow-blue rd-drift-b" style={{ width: 460, height: 460, right: "-10%", top: "-10%", opacity: 0.3 }} />
          <div className="relative max-w-7xl mx-auto px-5 sm:px-6">
            <div className="max-w-2xl" data-reveal>
              <Eyebrow>Teams & Offices</Eyebrow>
              <h2 className="rd-h2 text-[clamp(2rem,4.2vw,3.3rem)] text-white mt-5">
                One brand. <span className="rd-aurora-text">Everyone on it.</span>
              </h2>
              <p className="text-white/55 text-[1.1rem] mt-4 leading-relaxed">
                Roll out cards across your whole team with consistent branding, shared templates, and one place to manage seats. Every rep looks sharp — and every lead is accounted for.
              </p>
            </div>
            <div className="mt-12 grid sm:grid-cols-3 gap-4" id="leads">
              {[
                { t: "Uniform branding", d: "Lock logo, colors, and template so every card is on-brand." },
                { t: "Lead capture, built in", d: "Every card and page captures contacts straight to your CRM." },
                { t: "Seats & roles", d: "Add or remove people in seconds. One bill, full control." },
              ].map((f, i) => (
                <div key={f.t} className="rd-glass p-6" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--rd-aurora)" }}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0" strokeLinecap="round" /></svg>
                  </div>
                  <p className="text-white font-semibold text-[17px]">{f.t}</p>
                  <p className="text-white/50 text-[14px] mt-1.5 leading-relaxed">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ FINAL CTA ═══════════════ */}
        <section className="relative py-28 sm:py-36 overflow-hidden" style={{ background: "var(--rd-ink-1000)" }}>
          <div className="absolute inset-0 opacity-90" style={{ background: "radial-gradient(80% 120% at 50% 120%, rgba(93,107,255,0.35), transparent 60%)" }} />
          <div className="rd-glow rd-glow-cyan rd-drift-a" style={{ width: 420, height: 420, left: "50%", transform: "translateX(-50%)", bottom: "-30%", opacity: 0.35 }} />
          <div className="relative max-w-3xl mx-auto px-5 sm:px-6 text-center">
            <h2 className="rd-display text-white text-[clamp(2.4rem,5.5vw,4.2rem)]" data-reveal>
              Be the one they <span className="rd-aurora-text rd-aurora-anim">remember.</span>
            </h2>
            <p className="text-white/60 text-[1.15rem] mt-5 max-w-[520px] mx-auto" data-reveal>
              Your free SwiftCard is a minute away. Share it today and watch your contacts roll in.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3" data-reveal>
              <Link href="/cards/new" className="rd-btn rd-btn-aurora rd-btn-lg">Create your free card</Link>
              <Link href="/pricing" className="rd-btn rd-btn-ghost-d rd-btn-lg">See pricing</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
