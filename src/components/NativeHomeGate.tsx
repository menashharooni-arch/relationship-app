"use client";

import { useEffect } from "react";
import { useIsNativeApp } from "@/lib/platform";

/**
 * The marketing homepage is not a screen in the native app.
 *
 * The shell's start URL is "/", which renders the full marketing site — hero,
 * "Get started free", feature sections, footer link columns. That is the wrong
 * first thing a user sees in an app they just installed, and it is also the
 * shape App Review guideline 4.2 rejects as "primarily a repackaged website".
 * In the shell, "/" must always resolve to the product: the dashboard when
 * signed in, and (via the dashboard's own auth guard) the login screen when not.
 *
 * The redirect normally happens in the sc-boot script in the root layout, which
 * runs before first paint so the hero is never rendered at all. This component
 * is the fallback for the case where window.Capacitor is not yet defined when
 * that script executes: useIsNativeApp() resolves after mount, so a redirect
 * from here costs a brief flash of the homepage but still never leaves the user
 * sitting on it. Renders nothing, and is inert on the web.
 */
export default function NativeHomeGate() {
  const native = useIsNativeApp();

  useEffect(() => {
    // location.replace, not router.push: "/" must not sit in the shell's
    // history, or the back gesture returns the user to the marketing site.
    if (native && window.location.pathname === "/") {
      window.location.replace("/dashboard");
    }
  }, [native]);

  return null;
}
