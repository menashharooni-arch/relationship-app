"use client";

import type { ReactNode } from "react";
import { useIsNativeApp } from "@/lib/platform";

/**
 * Renders its children on web (and on the server + first client paint, so there
 * is no hydration mismatch), and nothing inside the native Capacitor app.
 *
 * Use this to suppress selling surfaces (pricing links, upgrade/referral promos,
 * App Store popups, signup nudges) that a Server Component renders and therefore
 * can't gate with the useIsNativeApp() hook directly. It renders a fragment on
 * web, so it adds no DOM node and web output is byte-for-byte unchanged.
 */
export default function NativeHidden({ children }: { children: ReactNode }) {
  const native = useIsNativeApp();
  if (native) return null;
  return <>{children}</>;
}
