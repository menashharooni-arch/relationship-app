"use client";

import { useEffect, useState } from "react";

// Viewport width, not device type (unrelated to useIsNativeApp) — mirrors the
// `md` Tailwind breakpoint (768px) used everywhere else for responsive layout.
// Starts false (matches SSR/first paint) and flips via matchMedia once mounted.
export function useIsMobile(breakpointPx = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [breakpointPx]);

  return isMobile;
}
