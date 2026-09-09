import Link from "next/link";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import NativeHidden from "@/components/NativeHidden";

// ── The compact footer for the cream pages ──────────────────────────────────
//
// The full marketing footer (SiteFooter) belongs to the dark `rd-` pages. The
// cream surfaces — legal, company, blog, /compare and the SEO landing pages —
// carry this smaller one instead.
//
// It exists because that footer had been hand-copied into ELEVEN pages and had
// drifted in every way a copy can: six different link sets (blog had no
// Pricing at all, terms had no logo and no Home), two different legal lines
// ("© 2026 SwiftCard · New York, NY" vs "SwiftCard is operated by Swift Card
// Inc · New York, NY"), and one page using py-8 where the rest used py-10. Same
// footer, eleven slightly different footers. One component, one shape.
//
// Native shell: deliberately NOT tagged `sc-site-footer`. That class hides the
// big marketing footer inside the app; these pages (privacy, terms, SMS terms)
// are reachable from the app's own login form and keep their small footer, as
// they always have. The Pricing link is wrapped in NativeHidden — App Store
// 3.1.1, the shell never links to a selling surface. Pinned by
// tests/native-suppression.test.ts.

type Extra = { label: string; href: string };

export default function SiteFooterMini({ extra = [] }: { extra?: Extra[] }) {
  return (
    <footer className="border-t border-warm-border py-10 px-6 bg-cream mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <SwiftCardLogo size={24} />
        {/* py-1 on each link: at 14px these rows were 20px tall, under the
            24×24 floor in WCAG 2.5.8. The padding is invisible (the row is a
            flex line) and takes them to 28px. */}
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-slate-600">
          <Link href="/" className="py-1 hover:text-slate-900 transition-colors">Home</Link>
          <NativeHidden><Link href="/pricing" className="py-1 hover:text-slate-900 transition-colors">Pricing</Link></NativeHidden>
          {extra.map((l) => (
            <Link key={l.href} href={l.href} className="py-1 hover:text-slate-900 transition-colors">{l.label}</Link>
          ))}
          <Link href="/contact" className="py-1 hover:text-slate-900 transition-colors">Contact Us</Link>
          <Link href="/privacy" className="py-1 hover:text-slate-900 transition-colors">Privacy</Link>
          <Link href="/terms" className="py-1 hover:text-slate-900 transition-colors">Terms</Link>
        </nav>
        {/* slate-600, not the slate-400 every copy of this line used: on the
            cream ground that measured 2.4:1, far under WCAG 1.4.3's 4.5:1. This
            is the smallest text on the page, so it takes the darkest muted tier
            (7.1:1) rather than slate-500, which lands at 4.46:1 on cream. */}
        <p className="text-slate-600 text-xs text-center">
          © {new Date().getFullYear()} SwiftCard · Operated by Swift Card Inc · New York, NY
        </p>
      </div>
    </footer>
  );
}
