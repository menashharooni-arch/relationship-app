"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { trackCta } from "@/lib/events";

// Mobile-only sticky "Create your free card" bar for the marketing homepage.
// Most SwiftCard traffic is mobile (people first meet the product as a shared
// card link on a phone), and the hero CTA scrolls out of reach. This keeps the
// primary action one tap away — but only AFTER the hero, so it never competes
// with the hero's own button, and it hides near the footer so it doesn't cover
// the final CTA. Desktop is unaffected (md:hidden).
//
// It watches the hero button itself rather than a scroll threshold: "the hero
// CTA is off screen" is the actual condition, and a hardcoded pixel guess drifts
// the moment the hero copy changes length or wraps differently on a narrow phone.
export default function StickyMobileCTA({ watch = "hero-cta" }: { watch?: string }) {
  const [heroVisible, setHeroVisible] = useState(true);
  const [nearFooter, setNearFooter] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(watch);
    if (!hero) return;
    const io = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { rootMargin: "0px" },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, [watch]);

  useEffect(() => {
    const onScroll = () => {
      setNearFooter(
        window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 720,
      );
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const show = !heroVisible && !nearFooter;

  return (
    <div
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] transition-all duration-300 ${
        show ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
      }`}
      // aria-hidden while off screen so a screen reader doesn't announce a
      // control the user can't reach.
      aria-hidden={!show}
    >
      {/* Its own surface rather than a scrim: this bar floats over BOTH the light
          and dark homepage sections, and a white gradient would smear over the
          dark ones. */}
      <div className="rounded-2xl bg-white/95 backdrop-blur shadow-[0_10px_40px_-8px_rgba(15,23,42,0.5)] border border-slate-200/80 p-2">
        <Link
          href="/cards/new"
          tabIndex={show ? 0 : -1}
          onClick={() => trackCta("create_your_card", "sticky_mobile")}
          className="btn-cta flex items-center justify-center gap-2 w-full rounded-full bg-brand text-white font-semibold text-[15px] py-3.5 shadow-lg shadow-brand/30"
        >
          Create your free card
          <span aria-hidden="true">→</span>
        </Link>
        <p className="text-center text-[11px] text-slate-500 mt-1.5 mb-0.5">Free to start — no credit card required</p>
      </div>
    </div>
  );
}
