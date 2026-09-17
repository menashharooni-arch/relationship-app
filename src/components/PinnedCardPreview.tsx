"use client";

// The live preview on the two DESIGN steps, on a PHONE (owner, 2026-09-16):
//   • Card design   → the card
//   • Social design → the Swift Links page
// It sits at the top of the step and stays pinned to the top of the screen the
// whole time you scroll ("I want it to stay up there but when they scroll it
// still stays"), at a size you can actually read, and tapping it opens it full
// size. Card info and Socials keep their inline previews where they are.
//
// Plain CSS `position: sticky` — no scroll listener, and it pins before
// hydration. The strip carries the page's own background (sc-pinned-preview in
// globals.css) so the controls scrolling underneath never show through. Always
// mounted, never CSS-hidden on a phone, so CardScaler never measures an empty
// slot. Desktop (lg and up) keeps its pinned right-hand column instead.
//
// The full-size view is portalled to <body>: the sticky strip is its own
// stacking context (z-30), and a fixed overlay left inside it would sit UNDER
// anything else on the page with a higher z-index.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CardScaler from "@/components/CardScaler";
import InertPreview from "@/components/InertPreview";

function PinnedPreview({
  label,
  pinned,
  full,
  stickBelow,
}: {
  /** CSS selector of a sticky header this strip must pin BELOW (the Office
   *  admin's header + tabs). Its live height is measured; without it the strip
   *  pins under the status bar. */
  stickBelow?: string;
  /** What a tap does, for screen readers: "See your card full size". */
  label: string;
  pinned: React.ReactNode;
  full: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [below, setBelow] = useState<number | null>(null);

  useEffect(() => {
    if (!stickBelow) return;
    const el = document.querySelector(stickBelow) as HTMLElement | null;
    if (!el) return;
    const measure = () => setBelow(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stickBelow]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <div
        // Full-bleed (-mx-5) inside the editors' page gutter; inside the Office
        // console's column the strip stays within the column it pins in.
        className={`sc-pinned-preview lg:hidden sticky z-30 pt-2 pb-3 ${stickBelow ? "" : "-mx-5 px-5"}`}
        style={{ top: below !== null ? `${below}px` : "env(safe-area-inset-top, 0px)" }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          className="relative block mx-auto rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          {pinned}
          {/* The "tap me" cue: small, in a corner, never over a name. */}
          <span
            aria-hidden
            className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center shadow"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </span>
        </button>
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <>
          {/* Dim on its own non-scrolling layer: backdrop-filter on the same
              element as overflow-y-auto kills touch scrolling on iOS Safari. */}
          <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm" aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="fixed inset-0 z-[121] overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          >
            <div
              className="min-h-full flex flex-col items-center px-4 pb-10 pt-[max(1rem,calc(env(safe-area-inset-top)+0.75rem))]"
              onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="self-end mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2.5"
              >
                Close
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              {full}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

/** Card design: the card itself (the template element, exactly as the editor builds it). */
export default function PinnedCardPreview({ children, stickBelow }: { children: React.ReactNode; stickBelow?: string }) {
  const card = (
    <InertPreview className="rounded-xl overflow-hidden border border-gray-800 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <CardScaler>{children}</CardScaler>
    </InertPreview>
  );
  return (
    <PinnedPreview
      label="See your card full size"
      stickBelow={stickBelow}
      pinned={<div className="w-[min(320px,calc(100vw-40px))]">{card}</div>}
      full={<div className="w-full max-w-[460px] my-auto">{card}</div>}
    />
  );
}

/**
 * Social design: the Swift Links page. Pinned, it shows the TOP of the page —
 * header, name and socials — at a readable size, fading out below; the whole
 * page is one tap away. `children` is the SwiftLinkLivePreview element.
 */
export function PinnedLinkPreview({ children, stickBelow }: { children: React.ReactNode; stickBelow?: string }) {
  return (
    <PinnedPreview
      label="See your Swift Links page full size"
      stickBelow={stickBelow}
      pinned={
        <div
          className="w-[190px] max-h-[min(270px,34vh)] overflow-hidden rounded-[22px]"
          style={{ maskImage: "linear-gradient(180deg, #000 78%, transparent)", WebkitMaskImage: "linear-gradient(180deg, #000 78%, transparent)" }}
        >
          {children}
        </div>
      }
      full={<div className="w-full max-w-[390px]">{children}</div>}
    />
  );
}
