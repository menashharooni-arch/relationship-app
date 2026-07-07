"use client";

import { useEffect, useRef, useState } from "react";

// A number that counts up from 0 to `to` the first time it scrolls into view
// (limaone-style stat markers). Supports decimals + prefix/suffix.
export default function CountUpStat({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1400,
  className = "",
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) { setVal(to); return; }

    const run = () => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(to * eased);
        if (p < 1) requestAnimationFrame(tick);
        else setVal(to);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { run(); io.disconnect(); } },
      { threshold: 0.4 }
    );
    io.observe(el);

    // Safety net: these are headline stats — a value stuck at 0 would literally
    // read "0% of paper cards are tossed". If the observer never fires (odd
    // viewport, backgrounded tab that never regains focus, throttled rAF), snap
    // to the final value so the number is never left at 0.
    const fallback = window.setTimeout(() => {
      if (!started.current) { started.current = true; setVal(to); }
    }, 2600);

    return () => { io.disconnect(); window.clearTimeout(fallback); };
  }, [to, duration]);

  return (
    <p ref={ref} className={className}>
      {prefix}
      {val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </p>
  );
}
