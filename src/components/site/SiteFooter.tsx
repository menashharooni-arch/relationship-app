import Link from "next/link";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";

// Marketing footer — real routes only, no invented content.
const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Digital Cards", href: "/#cards" },
      { label: "SwiftLinks", href: "/#swiftlinks" },
      { label: "Email Signatures", href: "/#signature" },
      { label: "Lead Capture", href: "/#leads" },
      { label: "Analytics", href: "/#analytics" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Teams & Offices", href: "/#teams" },
      { label: "Apple Wallet", href: "/#wallet" },
      { label: "Apple Watch", href: "/#watch" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "See it live", href: "/preview" },
      { label: "Templates", href: "/templates" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="rd-dark2 relative overflow-hidden border-t border-white/10">
      <div className="rd-glow rd-glow-violet" style={{ width: 520, height: 520, left: "-10%", bottom: "-60%", opacity: 0.25 }} />
      <div className="max-w-7xl mx-auto px-5 sm:px-6 py-16 relative">
        <div className="grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <SwiftCardIcon size={30} />
              <span className="text-white font-bold text-[18px] tracking-tight">SwiftCard</span>
            </Link>
            <p className="text-white/45 text-[14px] leading-relaxed max-w-[240px]">
              The digital business card that shares itself. One tap, and you&apos;re in their phone — card, links, and everything you do.
            </p>
            <div className="mt-5 flex gap-2.5">
              <Link href="/login?mode=signup" className="rd-btn rd-btn-primary text-[13px] px-4 py-2">Get started free</Link>
            </div>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <p className="rd-eyebrow text-white/40 mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-[14px] text-white/55 hover:text-white transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="rd-hair-d my-10" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/35 text-[13px]">© {new Date().getFullYear()} SwiftCard. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-white/40 hover:text-white/70 text-[13px] transition-colors">Privacy</Link>
            <Link href="/contact" className="text-white/40 hover:text-white/70 text-[13px] transition-colors">Contact</Link>
            <span className="text-white/30 text-[13px]">Made for people who network.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
