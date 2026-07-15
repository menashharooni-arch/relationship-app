"use client";

import { useEffect, useRef, useState } from "react";

// ── Desktop product mocks on a phone ────────────────────────────────────────
// DashboardDemo and TeamsDashboard are faithful replicas of the real product:
// browser chrome, two-column boards, twelve-column tables. They need their full
// design width (~760–820px) to hold together.
//
// On a phone we SCALE the whole mock to the screen width, like a product
// screenshot. The earlier approach panned it at full size inside a horizontal
// scroller — that meant a mock two screens wide and two-plus screens tall that
// you had to drag around in both axes, which read as broken rather than "more
// this way". Scaled, the visitor sees the entire dashboard in one glance; the
// details aren't meant to be read here (the "Try the live demo" CTA under it is
// the readable version).
//
// At any container width >= minWidth nothing changes: no transform, no fixed
// height, the mock flows normally. The scale() transform is visual only — the
// inner block keeps its full layout width — so while scaled we set an explicit
// measured height and `contain: size` (same trick as CardScaler) to stop the
// intrinsic width inflating the section on phones.
export default function WideDemo({
  children,
  minWidth = 720,
}: {
  children: React.ReactNode;
  /** The width the mock actually needs to stay readable. */
  minWidth?: number;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0); // 0 = not measured yet (render hidden)
  const [height, setHeight] = useState(0);

  useEffect(() => {
    function recompute() {
      const w = outerRef.current?.clientWidth ?? minWidth;
      const s = Math.min(1, w / minWidth);
      const naturalH = innerRef.current?.offsetHeight ?? 0;
      setScale(s);
      setHeight(naturalH * s);
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    // Belt and braces: some embedded webviews deliver window resize but not
    // ResizeObserver callbacks, and rotation is the resize that matters here.
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [minWidth]);

  const scaled = scale > 0 && scale < 1;

  return (
    <div
      ref={outerRef}
      className="w-full"
      style={scaled ? { height: height || undefined, contain: "size" } : undefined}
    >
      <div
        ref={innerRef}
        style={
          scaled
            ? {
                width: minWidth,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }
            : { opacity: scale === 0 ? 0 : undefined }
        }
      >
        {children}
      </div>
    </div>
  );
}
