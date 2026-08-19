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

  return (
    <form
      onSubmit={go}
      className="flex items-center gap-2 rounded-full bg-white pl-3 pr-1.5 py-1.5 w-full sm:w-auto"
      style={{ boxShadow: "0 12px 32px -10px rgba(15,23,42,0.28), inset 0 0 0 1px rgba(15,23,42,0.08)" }}
    >
      <SwiftCardIcon size={26} />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your first name"
        aria-label="Your first name"
        autoComplete="given-name"
        maxLength={80}
        className="min-w-0 flex-1 sm:w-[150px] bg-transparent text-slate-900 placeholder-slate-400 text-[15px] font-medium focus:outline-none"
      />
      <button type="submit" className="rd-btn rd-btn-aurora shrink-0 !py-2.5 !px-5 text-sm whitespace-nowrap">
        Start for free
      </button>
    </form>
  );
}
