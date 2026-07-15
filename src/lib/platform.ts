import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Native-platform detection for the SwiftCard Capacitor iOS shell.
 *
 * ABSOLUTE RULE for this file: on the web (and during any server render) every
 * export here must resolve to `false`. It only becomes `true` when our bundle is
 * actually running inside the native Capacitor iOS webview, where
 * `window.Capacitor` is injected before our JS executes.
 *
 * SSR-safety: `detectNativeApp()` guards on `typeof window` first, so it is safe
 * to call during Next.js server-side rendering (no `window`/`document`) and it
 * returns `false` there. `@capacitor/core`'s `Capacitor.isNativePlatform()` is
 * itself import-safe in a plain Node/browser context (it returns `false` rather
 * than throwing), but we never even reach it on the server thanks to the guard.
 */
export function detectNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Synchronous convenience boolean for NON-render contexts only: event handlers,
 * `useEffect` bodies, and outbound request payloads (e.g. the /upgrade redirect,
 * the AI help request flag).
 *
 * Evaluated once at module load. On the server this is `false` (no window). On
 * the web client it is `false`. Inside the native shell it is `true`.
 *
 * ⚠️ DO NOT read this directly inside a component's render output. On the server
 * it is `false`, but the first client render inside the native shell would be
 * `true`, producing a React hydration mismatch. For render-time decisions use
 * {@link useIsNativeApp}, which stays `false` until after mount so server HTML
 * and the first client paint always agree.
 */
export const isNativeApp: boolean = detectNativeApp();

/**
 * Hydration-safe React hook for render-time platform decisions.
 *
 * Returns `false` on the server AND on the very first client render (so the
 * markup matches and there is no hydration mismatch), then flips to the real
 * value in a mount effect. This is the standard React pattern for
 * client-only-derived values.
 */
export function useIsNativeApp(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(detectNativeApp());
  }, []);
  return native;
}
