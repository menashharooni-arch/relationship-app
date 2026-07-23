"use client";

import { useEffect, useRef, useState } from "react";

// Renders content at a fixed design width where everything fits, then scales it
// down to the container width. Cards use it (fixed 460px so the QR / bottom rows
// never clip on narrow screens); the Swift Links live preview passes a phone
// width (~390) so the real profile renders at true phone proportions and is then
// shrunk into the preview slot — pixel-identical to the published page, just
// smaller.
const DEFAULT_NATURAL = 460;

export default function CardScaler({ children, natural = DEFAULT_NATURAL }: { children: React.ReactNode; natural?: number }) {
  const NATURAL = natural;
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    function recompute() {
      const w = outerRef.current?.clientWidth ?? NATURAL;
      const s = Math.min(1, w / NATURAL);
      const naturalH = innerRef.current?.offsetHeight ?? Math.round(NATURAL / 1.75);
      setScale(s);
      setHeight(naturalH * s);
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [NATURAL]);

  return (
    // contain:size — the inner card keeps a fixed LAYOUT width of 460px (the
    // scale() transform is visual only), which would otherwise inflate any
    // auto-sized grid/flex track holding a card to >=460px on phones and get
    // it clipped. Size containment zeroes that intrinsic contribution; the
    // explicit measured height keeps layout correct.
    <div ref={outerRef} className="w-full" style={{ height: height || undefined, contain: "size" }}>
      <div
        ref={innerRef}
        style={{
          width: NATURAL,
          transform: scale ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
          opacity: scale ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
