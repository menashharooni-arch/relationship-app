// The card preview on the Card design step, on a PHONE: it sits at the top of
// the step and stays pinned to the top of the screen the whole time you scroll
// through Logo & headshot, Template and the numbered design steps (owner, 2026-09-16:
// "I want it to stay up there but when they scroll it still stays").
//
// This replaces the old pair of an inline preview mid-step plus a small copy
// that docked only once the inline one scrolled away. One element, always
// mounted, so CardScaler never measures a hidden slot.
//
// Plain CSS `position: sticky` — no scroll listener, and it works before
// hydration. The strip carries the page's own background (sc-pinned-preview in
// globals.css) so the controls scrolling underneath never show through.
// Desktop (lg and up) keeps its pinned right-hand column instead.

import CardScaler from "@/components/CardScaler";
import InertPreview from "@/components/InertPreview";

export default function PinnedCardPreview({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="sc-pinned-preview lg:hidden sticky z-30 -mx-5 px-5 pt-2 pb-3"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="w-full max-w-[300px] mx-auto">
        <InertPreview className="rounded-xl overflow-hidden border border-gray-800 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <CardScaler>{children}</CardScaler>
        </InertPreview>
      </div>
    </div>
  );
}
