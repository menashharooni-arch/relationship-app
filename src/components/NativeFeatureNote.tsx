"use client";

import { useIsNativeApp } from "@/lib/platform";

// Honesty note shown ONLY inside the native iOS shell (App Review 2.3.1):
// marketing pages are in-app content there, so any capability described in
// aspirational terms gets an exact "how it works today" clarifier. Renders
// null on the web and during SSR — the public site is byte-identical.
export default function NativeFeatureNote({ children }: { children: React.ReactNode }) {
  const native = useIsNativeApp();
  if (!native) return null;
  return (
    <p className="text-white/45 text-[13px] mt-4 leading-relaxed max-w-[620px]">
      {children}
    </p>
  );
}
