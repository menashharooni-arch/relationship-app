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
    // The value can only be read from `window`, so computing it during render
    // would make the server and first client render disagree and blow up
    // hydration. Deferring it to a mount effect is the documented React pattern
    // (see the JSDoc above); the one extra render is the entire point.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe by design
    setNative(detectNativeApp());
  }, []);
  return native;
}

/**
 * Is this the iPhone app running on an Apple Silicon Mac?
 *
 * The native shell sets `data-sc-mac` on <html> from
 * `ProcessInfo.processInfo.isiOSAppOnMac` (MainViewController.applyPlatformFlags).
 * Nothing in the webview can work this out for itself: on a Mac the user agent
 * still says iPhone and Capacitor still reports platform "ios", so every
 * "am I native?" check answers yes and the feature fails later, at the point of
 * use, with no explanation.
 *
 * What is genuinely missing on a Mac, and what this gates:
 *   • Core NFC          — no NFC radio (NFCWriter already self-detects via NDEFReader)
 *   • Apple Wallet      — PassKit will not add a pass from an iOS app on Mac
 *   • The rear camera   — no scanning a code by pointing the device at it
 * Everything else — sharing, QR display, contact saving, forms, uploads,
 * purchases — works, so nothing else is hidden.
 *
 * Returns false on the web and during SSR, like everything else in this file.
 */
export function detectIosAppOnMac(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.scMac === "1";
}

/** Hydration-safe hook — false until after mount, so SSR and first paint agree. */
export function useIsIosAppOnMac(): boolean {
  const [onMac, setOnMac] = useState(false);
  useEffect(() => {
    // Same reason as useIsNativeApp: the flag only exists on the document once
    // the native shell has written it, so reading it during render would
    // mismatch SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe by design
    setOnMac(detectIosAppOnMac());
  }, []);
  return onMac;
}
