"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";

// ── The homepage hero claim box ──────────────────────────────────────────────
//
// Owner request 2026-08-19, modeled on link.me's hero: a white pill holding
// the brand mark, an inline first-name input, and an attached "Start for
// free" button. Enter or the button routes into the card builder with the
// typed name pre-filled (?name=…), so the visitor's first act of typing is
// already the first field of their card — the CTA IS the product.
//
// Empty submits still go to the builder: an empty box must never be a wall
// between a willing visitor and the wizard.

export default function HeroClaim() {
  const router = useRouter();
  const [name, setName] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const v = name.trim().slice(0, 80);
    router.push(v ? `/cards/new?name=${encodeURIComponent(v)}&src=hero_claim` : "/cards/new?src=hero_claim");
  }

  // Reads as the URL they are claiming: "SwiftCard.me/" in solid dark ink
  // (never faded), the typed name completing it; the placeholder "full name"
  // sits in light gray until they type (owner spec 2026-08-19). Sized up to a
  // comfortable hero weight.
  return (
    <form
      onSubmit={go}
      className="relative overflow-hidden flex items-center gap-2.5 sm:gap-3 rounded-full pl-4 sm:pl-5 pr-2 sm:pr-2.5 py-2 sm:py-2.5 w-full sm:w-auto"
      style={{
        // A whisper of a vertical gradient instead of flat white: it gives the
        // glare sweep something to read against, and the pill a hint of glass.
        background: "linear-gradient(180deg, #FFFFFF 0%, #F7F9FC 100%)",
        boxShadow: "0 16px 40px -12px rgba(15,23,42,0.28), inset 0 0 0 1px rgba(15,23,42,0.08)",
      }}
    >
      <SwiftCardIcon size={28} />
      <label className="flex items-baseline min-w-0 flex-1 cursor-text" htmlFor="hero-claim-name">
        <span className="text-slate-900 font-semibold text-[14px] sm:text-[17px] whitespace-nowrap select-none">SwiftCard.me/</span>
        <input
          id="hero-claim-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="full name"
          aria-label="Your full name"
          autoComplete="name"
          maxLength={80}
          className="min-w-[92px] flex-1 sm:w-[150px] bg-transparent text-slate-900 placeholder-slate-300 text-[14px] sm:text-[17px] font-semibold focus:outline-none"
        />
      </label>
      <button type="submit" className="rd-btn rd-btn-aurora shrink-0 !py-2.5 !px-4 sm:!py-3 sm:!px-6 text-[13px] sm:text-[15px] whitespace-nowrap">
        Start for free
      </button>
      {/* Very light glare, sweeping the whole pill (button included) on a slow
          cycle. Above the content (the whole point of a glare), inert to the
          pointer, and killed for reduced-motion in globals.css. */}
      <span aria-hidden="true" className="rd-claim-glare" />
    </form>
  );
}
