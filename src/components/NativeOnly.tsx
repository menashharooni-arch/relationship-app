"use client";

import type { ReactNode } from "react";
import { useIsNativeApp } from "@/lib/platform";

/**
 * The exact inverse of {@link NativeHidden}: renders its children ONLY inside
 * the native Capacitor app, and nothing on the web.
 *
 * The pair exists because App Store guideline 3.1.1 forbids pointing users at
 * external purchasing, so a link to /pricing has to disappear in the app — but
 * deleting it outright can leave a sentence with a hole in it ("pricing is shown
 * on the ."). NativeHidden supplies the web wording, NativeOnly the app wording,
 * and the prose stays grammatical on both.
 *
 * Renders nothing on the server AND on the first client paint, matching
 * useIsNativeApp()'s contract, so the server HTML and first client render always
 * agree and hydration never mismatches. Consequently the web output is unchanged
 * byte-for-byte: on the web this component never renders anything at all.
 */
export default function NativeOnly({ children }: { children: ReactNode }) {
  const native = useIsNativeApp();
  if (!native) return null;
  return <>{children}</>;
}
