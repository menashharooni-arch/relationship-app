import Link from "next/link";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";
import SalesChat from "@/components/site/SalesChat";
import NativeHidden from "@/components/NativeHidden";
import { APP_STORE_URL } from "@/lib/app-store";

// Marketing footer — real routes only, no invented content.
const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Digital Cards", href: "/products/digital-cards" },
      { label: "SwiftLinks", href: "/products/swiftlinks" },
      { label: "Swift Signature", href: "/products/email-signatures" },
      { label: "Lead Capture", href: "/products/lead-capture" },
      { label: "Dashboard & Analytics", href: "/products/analytics" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Teams & Offices", href: "/products/teams" },
      { label: "Apple Wallet", href: "/products/wallet" },
      { label: "Apple Watch", href: "/products/watch" },
      { label: "Integrations", href: "/products/integrations" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    // The /for/[slug] vertical landing pages. Linked here so they aren't
    // orphans — pages with no internal links barely rank, and ranking for
    // "digital business card for <industry>" is their entire job.
    title: "Who it's for",
    links: [
      { label: "Real estate agents", href: "/for/real-estate-agents" },
      { label: "Contractors", href: "/for/contractors" },
      { label: "Insurance agents", href: "/for/insurance-agents" },
      { label: "Loan officers", href: "/for/loan-officers" },
      { label: "Lawyers", href: "/for/lawyers" },
      { label: "Photographers", href: "/for/photographers" },
      { label: "Barbers & stylists", href: "/for/barbers-and-stylists" },
      { label: "Car salespeople", href: "/for/car-salespeople" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Preview", href: "/preview" },
      { label: "Templates", href: "/templates" },
      { label: "Why SwiftCard", href: "/testimonials" },
      { label: "Company", href: "/company" },
      { label: "Contact Us", href: "/contact" },
      { label: "Privacy Policy", href: "/privacy" },
      // "Terms of Service", not "Terms & Legal": A2P 10DLC vetting crawls the
      // registered website (swiftcard.me) for a Terms & Conditions page and
      // matches on conventional anchor text. Campaign rejection 30882 said the
      // T&C could not be verified while this link read "Terms & Legal" — a
      // label a policy scanner has no reason to recognise.
      { label: "Terms of Service", href: "/terms" },
      { label: "SMS Terms", href: "/sms-terms" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <>
    {/* Site-wide sales chatbot — appears on every marketing page via the footer */}
    {/* App Store 3.1.1: sales chat discusses pricing — never in the native shell. */}
    <NativeHidden><SalesChat /></NativeHidden>
    {/* sc-site-footer: marketing chrome, hidden in the native shell by
        globals.css. Three columns of site links and a "Get started free" CTA
        below every page is the clearest tell that an app is a wrapped website —
        and the surface App Review reads as one. */}
    <footer className="sc-site-footer rd-dark2 relative overflow-hidden border-t border-white/10">
      <div className="rd-glow rd-glow-violet" style={{ width: 520, height: 520, left: "-10%", bottom: "-60%", opacity: 0.25 }} />
      <div className="max-w-7xl mx-auto px-5 sm:px-6 py-16 relative">
        <div className="grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <SwiftCardIcon size={30} />
              <span className="text-white font-bold text-[18px] tracking-tight">SwiftCard</span>
            </Link>
            <p className="text-white/45 text-[14px] leading-relaxed max-w-[240px]">
              The digital business card that shares itself. One tap, and you&apos;re in their phone — card, links, and everything you do.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link href="/cards/new" className="rd-btn rd-btn-primary text-[13px] px-4 py-2">Get started free</Link>
            </div>
            {/* The App Store badge (the homepage hero carries the other one).
                It renders ONLY once NEXT_PUBLIC_APP_STORE_URL is set, so it is
                absent while the app is in review and appears by itself the
                moment the listing is live — no second deploy to remember. That
                is the same self-activating pattern AppStoreReviews uses.
                Deliberately NOT wrapped in NativeHidden's opposite: someone
                reading the marketing site in a browser is exactly who should
                see it, and the whole footer is already hidden in the shell. */}
            {APP_STORE_URL && (
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download SwiftCard on the App Store"
                className="mt-4 inline-flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2 transition-colors hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="w-[22px] h-[22px] shrink-0" fill="#fff">
                  <path d="M16.365 1.43c0 1.14-.417 2.2-1.11 2.98-.75.84-1.98 1.49-3.02 1.4-.13-1.09.42-2.24 1.09-2.98.76-.85 2.07-1.47 3.04-1.4zM20.5 17.02c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.39 3.52-4.12 3.53-1.54.01-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.02-3.06-1.78-4.05-3.35-2.77-4.38-3.06-9.52-1.35-12.25 1.21-1.94 3.13-3.08 4.94-3.08 1.84 0 3 1.01 4.52 1.01 1.48 0 2.38-1.01 4.51-1.01 1.61 0 3.32.88 4.54 2.39-3.99 2.19-3.34 7.88.1 9.25z" />
                </svg>
                <span className="leading-tight">
                  <span className="block text-white/50 text-[10px]">Download on the</span>
                  <span className="block text-white font-semibold text-[14px] tracking-tight">App Store</span>
                </span>
              </a>
            )}
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <p className="rd-eyebrow text-white/40 mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => {
                  const li = (
                    <li key={l.label}>
                      <Link href={l.href} className="text-[14px] text-white/55 hover:text-white transition-colors">{l.label}</Link>
                    </li>
                  );
                  // Hide the Pricing link inside the native app (no selling).
                  return l.href === "/pricing" ? <NativeHidden key={l.label}>{li}</NativeHidden> : li;
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="rd-hair-d my-10" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/35 text-[13px]">
            © {new Date().getFullYear()} SwiftCard. All rights reserved.{" "}
            <Link href="/company" className="hover:text-white/60 transition-colors">SwiftCard is operated by Swift Card Inc.</Link>
          </p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-white/40 hover:text-white/70 text-[13px] transition-colors">Privacy</Link>
            <Link href="/contact" className="text-white/40 hover:text-white/70 text-[13px] transition-colors">Contact Us</Link>
          </div>
        </div>
      </div>
    </footer>
    </>
  );
}
