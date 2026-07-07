"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Mobile-only sticky "Create your free card" bar for the marketing homepage.
// Most SwiftCard traffic is mobile (people first meet the product as a shared
// card link on a phone), and the hero CTA scrolls out of reach. This keeps the
// primary action one tap away — but only AFTER the hero, so it never competes
// with the hero's own button, and it hides near the footer so it doesn't cover
// the final CTA. Desktop is unaffected (md:hidden).
export default function StickyMobileCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const nearBottom =
        window.innerHeight + y > document.documentElement.scrollHeight - 720;
      // Appear once past the fold, hide again over the footer CTA.
      setShow(y > 560 && !nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-white via-white/95 to-transparent transition-all duration-300 ${
        show ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
      }`}
    >
      <Link
        href="/login?mode=signup"
        className="btn-cta flex items-center justify-center gap-2 w-full rounded-full bg-brand text-white font-semibold text-[15px] py-3.5 shadow-lg shadow-brand/30"
      >
        Create your free card
        <span aria-hidden>→</span>
      </Link>
      <p className="text-center text-[11px] text-slate-500 mt-1.5">Free to start — no credit card required</p>
    </div>
  );
}
