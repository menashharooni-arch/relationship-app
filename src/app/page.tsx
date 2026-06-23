import Link from "next/link";
import KontactLogo from "@/components/KontactLogo";
import ClassicPro from "@/components/card-templates/ClassicPro";
import { SAMPLE_DATA } from "@/components/card-templates/types";

const STEPS = [
  {
    n: "01",
    title: "Set up your card",
    body: "Add your name, title, contact details, and social links. Your card is live in under a minute.",
  },
  {
    n: "02",
    title: "Share it anywhere",
    body: "Send your link, show your QR code, or tap an NFC card. The other person needs no app to view it.",
  },
  {
    n: "03",
    title: "Leads come to you",
    body: "When someone shares their info back, it appears instantly in your dashboard with automated follow-ups.",
  },
];

const FEATURES = [
  {
    title: "No app required",
    body: "Your card opens in any browser on any device. One tap saves your contact directly to their phone.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3" />
      </svg>
    ),
  },
  {
    title: "Automated follow-ups",
    body: "Your leads receive a personal email from you the next day. Reminders go out at day 1, 15, and 30 — all on autopilot.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
      </svg>
    ),
  },
  {
    title: "Card view analytics",
    body: "See exactly who viewed your card and when. Know who's engaged before you pick up the phone.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    title: "Lead pipeline",
    body: "Tag every lead as Hot, Warm, Cold, or Won. Add notes, track conversations, and never lose a deal.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
  {
    title: "5 professional templates",
    body: "Choose from Classic, Modern, Photo, Local Business, or Luxury Minimal. Switch anytime.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    title: "Share anywhere",
    body: "QR code, link, NFC card, or the native share sheet on any phone. Every format covered.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
      </svg>
    ),
  },
];

const TESTIMONIALS = [
  {
    quote: "I handed out 200 paper cards at a trade show and got zero follow-ups. With Kontact I closed 3 deals from one event.",
    name: "Kourosh Lavi",
    role: "Commercial Real Estate",
    initial: "K",
  },
  {
    quote: "My clients always lose my card. Now I text them my Kontact link and they have everything saved permanently.",
    name: "Hilda Lavi",
    role: "Independent Contractor",
    initial: "H",
  },
  {
    quote: "The automated follow-up emails do the work for me. Leads just reply and the conversation picks up on its own.",
    name: "Yoni Lavi",
    role: "Sales Manager",
    initial: "Y",
  },
];

const FAQS = [
  {
    q: "Does the person I share with need to download anything?",
    a: "No. Your card opens in any browser instantly. They can save your contact to their phone with one tap — no app, no account, no friction.",
  },
  {
    q: "What happens when someone shares their info with me?",
    a: "Their name, email, and phone appear in your dashboard immediately. An automated email goes out to them the next day, keeping the relationship warm without you lifting a finger.",
  },
  {
    q: "Can I use Kontact with NFC cards?",
    a: "Yes. Your card URL is NFC-ready out of the box. Buy any blank NFC card or sticker, write your Kontact link to it with a free app, and anyone who taps it sees your card instantly.",
  },
  {
    q: "What's the difference between Free and Pro?",
    a: "Free gives you one card and 25 leads — plenty to get started. Pro removes the lead limit, gives you up to 3 cards, unlocks analytics, and removes the Kontact branding from your card.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no commitments. Cancel from your account at any time and you keep access until the end of your billing period.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex flex-col">

      {/* Nav */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
          <KontactLogo size={30} />
          <div className="flex items-center gap-8">
            <Link href="/pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">
              Pricing
            </Link>
            <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto w-full px-6 pt-20 pb-28 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div>
          <div className="inline-flex items-center gap-2 border border-slate-200 rounded-full px-4 py-1.5 text-xs text-slate-500 mb-10 bg-slate-50">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Free to start — no credit card required
          </div>

          <h1 className="text-[3.25rem] font-bold text-slate-900 leading-[1.1] tracking-tight mb-6">
            The digital business card that captures every lead.
          </h1>

          <p className="text-slate-500 text-lg leading-relaxed mb-10 max-w-md">
            Share your card by link, QR code, or NFC tap. Leads save your contact in one touch. Automated follow-ups do the rest.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-3.5 rounded-full text-sm transition-colors text-center"
            >
              Create your free card
            </Link>
            <Link
              href="/pricing"
              className="border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-semibold px-7 py-3.5 rounded-full text-sm transition-colors text-center"
            >
              View pricing
            </Link>
          </div>

          <p className="text-slate-400 text-xs mt-5">Ready in 60 seconds. No design experience needed.</p>
        </div>

        {/* Card preview */}
        <div className="relative hidden lg:block">
          <div className="absolute -inset-6 bg-blue-50 rounded-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-slate-400 text-xs tracking-wide">Live card preview</span>
            </div>
            <ClassicPro data={SAMPLE_DATA} />
            <p className="text-slate-400 text-xs mt-3 pl-1">kontact.app/card/alexmorgan</p>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="border-y border-slate-100 bg-slate-50 py-10 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: "60 sec", label: "Average setup time" },
            { value: "3×", label: "More follow-ups than paper cards" },
            { value: "100%", label: "Browser-based, no app needed" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-bold text-slate-900 mb-1">{s.value}</p>
              <p className="text-slate-500 text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className="py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-3">How it works</p>
            <h2 className="text-3xl font-bold text-slate-900">Simple by design</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block absolute top-5 left-[60%] w-full h-px bg-slate-200" />
                )}
                <div className="text-xs font-bold text-slate-400 tracking-widest mb-4">{s.n}</div>
                <h3 className="text-slate-900 font-semibold text-base mb-2">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-100 bg-slate-50 py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-3">Features</p>
            <h2 className="text-3xl font-bold text-slate-900">Everything you need to network smarter</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
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
      <section className="border-t border-slate-100 py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-3">Testimonials</p>
            <h2 className="text-3xl font-bold text-slate-900">What our users say</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white border border-slate-200 rounded-2xl p-7 flex flex-col shadow-sm">
                <div className="flex gap-0.5 mb-5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} viewBox="0 0 20 20" fill="#d97706" className="w-3.5 h-3.5">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed flex-1 mb-6">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
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
      <section className="border-t border-slate-100 bg-slate-50 py-28 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-3">FAQ</p>
            <h2 className="text-3xl font-bold text-slate-900">Common questions</h2>
          </div>
          <div className="space-y-0 divide-y divide-slate-200">
            {FAQS.map((f) => (
              <div key={f.q} className="py-6">
                <p className="text-slate-900 font-semibold text-sm mb-2">{f.q}</p>
                <p className="text-slate-500 text-sm leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-28 px-6">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            Your next deal starts with a better introduction.
          </h2>
          <p className="text-blue-100 mb-10">
            Set up your digital card in 60 seconds. Free to start, no credit card needed.
          </p>
          <Link
            href="/login"
            className="inline-block bg-white hover:bg-blue-50 text-blue-600 font-semibold px-8 py-3.5 rounded-full text-sm transition-colors"
          >
            Create your free card
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 px-6 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <KontactLogo size={26} />
          <div className="flex items-center gap-8 text-sm text-slate-500">
            <Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-slate-900 transition-colors">Sign in</Link>
            <Link href="/login" className="hover:text-slate-900 transition-colors">Get started</Link>
          </div>
          <p className="text-slate-400 text-xs">© {new Date().getFullYear()} Kontact. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
