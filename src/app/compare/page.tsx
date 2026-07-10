import Link from "next/link";
import type { Metadata } from "next";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import MarketingNav from "@/components/MarketingNav";
import ScrollProgress from "@/components/ScrollProgress";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata: Metadata = {
  title: "SwiftCard vs Linktree, Popl & Blinq — Digital Business Card Comparison",
  description:
    "How SwiftCard compares to Linktree, Popl, and Blinq on price, lead capture, and follow-up automation. See the real differences before you switch.",
};

type Row = { label: string; swiftcard: string; linktree: string; popl: string; blinq: string };

// Every figure below is sourced from each competitor's own public pricing page
// as of publish — verify current pricing directly with them before switching,
// since plans and prices change. SwiftCard's numbers are the same ones live on /pricing.
const ROWS: Row[] = [
  { label: "Starting price", swiftcard: "Free", linktree: "Free (12% fee on sales)", popl: "Free", blinq: "Free" },
  { label: "Cheapest paid plan", swiftcard: "$4.99/mo", linktree: "$8/mo (Starter)", popl: "$7.99/mo (Pro)", blinq: "~$3–10/mo (Premium, by billing term)" },
  { label: "Built-in lead CRM (statuses, notes, pipeline)", swiftcard: "✓", linktree: "✗", popl: "Via 3rd-party integrations", blinq: "Via 3rd-party integrations" },
  { label: "Automated follow-up sequences (email + text)", swiftcard: "✓", linktree: "✗", popl: "✗", blinq: "✗" },
  { label: "NFC tap-to-share", swiftcard: "✓", linktree: "✗", popl: "✓", blinq: "✓" },
  { label: "Custom card designer", swiftcard: "✓ (Pro)", linktree: "N/A — link-in-bio, not a card", popl: "Limited", blinq: "✓" },
  { label: "Team/office pricing", swiftcard: "$3.99/seat/mo · min 2 seats", linktree: "N/A", popl: "$5/user/mo · min 5 seats", blinq: "$4.99/user/mo · min 5 seats" },
];

function Cell({ value, brand }: { value: string; brand?: boolean }) {
  const isCheck = value === "✓";
  const isCross = value === "✗";
  return (
    <td
      className={`px-4 py-4 text-sm text-center align-middle ${brand ? "font-semibold" : "text-slate-600"}`}
      style={brand ? { color: "#1D4ED8" } : undefined}
    >
      {isCheck ? <span className="text-green-600 text-base">✓</span> : isCross ? <span className="text-slate-300">✗</span> : value}
    </td>
  );
}

export default function ComparePage() {
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <ScrollProgress />
      <ScrollReveal />
      <MarketingNav />

      <section className="text-center px-6 pt-16 pb-10">
        <p className="text-[11px] font-bold tracking-[0.25em] text-brand uppercase mb-4">Comparison</p>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">SwiftCard vs Linktree, Popl &amp; Blinq</h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto mb-2">
          Looking for a Linktree alternative, or weighing Popl against Blinq? Here&apos;s how SwiftCard actually compares — real numbers, no spin.
        </p>
        <p className="text-slate-400 text-xs max-w-xl mx-auto">
          Competitor pricing/features sourced from their public pricing pages and subject to change — confirm current details directly with them.
        </p>
      </section>

      <section className="max-w-4xl mx-auto w-full px-6 pb-12">
        <div className="overflow-x-auto rounded-3xl border border-warm-border bg-white shadow-sm">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-warm-border">
                <th className="px-4 py-4 text-left text-sm font-semibold text-slate-900 w-1/3">&nbsp;</th>
                <th className="px-4 py-4 text-sm font-bold text-center" style={{ color: "#1D4ED8" }}>SwiftCard</th>
                <th className="px-4 py-4 text-sm font-semibold text-slate-500 text-center">Linktree</th>
                <th className="px-4 py-4 text-sm font-semibold text-slate-500 text-center">Popl</th>
                <th className="px-4 py-4 text-sm font-semibold text-slate-500 text-center">Blinq</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={row.label} className={i % 2 === 1 ? "bg-[#FAF7F2]" : ""}>
                  <td className="px-4 py-4 text-sm font-medium text-slate-700">{row.label}</td>
                  <Cell value={row.swiftcard} brand />
                  <Cell value={row.linktree} />
                  <Cell value={row.popl} />
                  <Cell value={row.blinq} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 max-w-2xl mx-auto text-center">
          <p className="text-slate-600 text-sm leading-relaxed mb-2">
            <strong className="text-slate-900">Linktree</strong> is built for link-in-bio, not lead capture — it doesn&apos;t have a contacts CRM
            or follow-up automation because that&apos;s not what it&apos;s for.
          </p>
          <p className="text-slate-600 text-sm leading-relaxed mb-2">
            <strong className="text-slate-900">Popl</strong> and <strong className="text-slate-900">Blinq</strong> both do NFC sharing and CRM
            <em> integrations</em> well, but neither has SwiftCard&apos;s built-in automated email + text follow-up sequences out of the box —
            you&apos;d need to wire that up yourself through Zapier or a separate tool.
          </p>
          <p className="text-slate-600 text-sm leading-relaxed">
            SwiftCard bundles the card, the CRM, and the follow-up automation into one $4.99/mo plan — no separate tools to connect.
          </p>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/login?mode=signup"
            className="btn-cta bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3.5 rounded-full text-sm transition-colors inline-block"
          >
            Try SwiftCard free →
          </Link>
        </div>
      </section>

      <footer className="border-t border-warm-border py-10 px-6 bg-cream mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <SwiftCardLogo size={24} />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
          </div>
          <p className="text-slate-400 text-xs">© {new Date().getFullYear()} SwiftCard · New York, NY</p>
        </div>
      </footer>
    </main>
  );
}
