"use client";

// A small copy of the card that docks to the top of the screen on a PHONE, but
// only once the Card design tab's own inline preview has scrolled out of view.
//
// Why only then: an always-sticky preview at the top of the step was tried and
// removed — it took a quarter of the screen before you had touched anything
// (tests/mobile-editor-previews.test.ts forbids it coming back). Without any
// dock, though, the card you are recolouring is off-screen the moment you reach
// the colour, font and finish controls. Appearing only when the real preview has
// left gives both: nothing covers the step at rest, and every swatch tap is
// visible while you work.
//
// Rendered conditionally, never CSS-hidden. CardScaler reports a zero-width slot
// as a production error (cardscaler.collapsed), and a display:none dock would
// be exactly that on every page load.

import { useEffect, useState } from "react";
import CardScaler from "@/components/CardScaler";
import InertPreview from "@/components/InertPreview";

export default function DockedCardPreview({
  anchorId,
  enabled = true,
  children,
}: {
  /** id of the inline preview this dock stands in for while it is off-screen. */
  anchorId: string;
  /** False while something else is the live canvas (the custom designer) or the design is locked. */
  enabled?: boolean;
  /** The card template element, exactly as the inline preview renders it. */
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    // Phones and tablets only: lg and up already pin the preview in its column.
    const narrow = window.matchMedia("(max-width: 1023.98px)");
    // A position check on scroll, not an IntersectionObserver. An observer only
    // reports a CHANGE in visibility, so a jump from "below the fold" straight
    // to "scrolled past" — a fast fling, or opening the tab with the preview
    // already off-screen — never flips it, and the dock never appeared. Found
    // driving the real editor at 390px. One rAF-throttled read per frame.
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = document.getElementById(anchorId);
      setShow(!!el && narrow.matches && el.getBoundingClientRect().bottom < 0);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    narrow.addEventListener("change", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      narrow.removeEventListener("change", schedule);
    };
  }, [anchorId, enabled]);

  if (!enabled || !show) return null;

  return (
    <div
      className="lg:hidden fixed inset-x-0 z-40 flex justify-center pointer-events-none"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
      aria-hidden="true"
    >
      <div className="mt-2 w-[min(210px,56vw)] max-h-[30vh] rounded-xl overflow-hidden border border-gray-700/80 shadow-[0_10px_30px_rgba(0,0,0,0.55)] motion-safe:animate-[sc-dock-in_160ms_ease-out]">
        <style>{`@keyframes sc-dock-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }`}</style>
        <InertPreview>
          <CardScaler>{children}</CardScaler>
        </InertPreview>
      </div>
    </div>
  );
}
