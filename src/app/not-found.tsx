import Link from "next/link";
import SwiftCardLogo from "@/components/SwiftCardLogo";

// Almost every 404 on this domain is a mistyped or outdated card/share link —
// SwiftCard's whole product is people passing around card URLs, so a typo
// (swiftcard.me/menash instead of /menash1) is the single most common way
// anyone ends up here. That's free, warm traffic currently hitting a dead
// end — this turns it into a signup instead of a bounce.
export default function NotFound() {
  return (
    <main className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
      <Link href="/" className="mb-8">
        <SwiftCardLogo size={30} />
      </Link>
      <div className="w-16 h-16 rounded-2xl bg-[#EDE5D8] border border-[#D4C8B8] flex items-center justify-center mb-6">
        <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={1.5} className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 17.25h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Couldn&apos;t find that card</h1>
      <p className="text-slate-500 text-sm mb-8 max-w-sm leading-relaxed">
        The link you followed might be mistyped or the card may have moved. But you can make your own SwiftCard in about 30 seconds.
      </p>
      <Link
        href="/login?mode=signup"
        className="bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3.5 rounded-full text-sm transition-colors"
      >
        Create your free card →
      </Link>
      <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 transition-colors mt-6">
        Back to swiftcard.me
      </Link>
    </main>
  );
}
