"use client";

import { useEffect } from "react";
import { detectNativeApp } from "@/lib/platform";

/**
 * Native-shell runtime bridge. Renders nothing; on web every effect is a no-op.
 *
 * Inside the Capacitor iOS shell it wires two things:
 *
 * 1. Universal Links → webview navigation. When iOS opens the app from a
 *    swiftcard.me link (AASA paths: /card/*, /links/*, /auth/callback), the
 *    shell fires `appUrlOpen`; we navigate the webview to that exact URL. This
 *    is ALSO the return leg of the native login flow: the system-browser OAuth
 *    round-trip ends at /auth/callback?code=…, the universal link re-opens the
 *    app, and navigating the webview there completes the PKCE exchange with
 *    the code_verifier already sitting in the webview's storage.
 *
 * 2. In-app browser cleanup after that hand-off (`Browser.close()` is safe to
 *    call even when nothing is open).
 *
 * Uses dynamic imports so none of the Capacitor plugin JS enters the web
 * bundle; on web the effect returns before any import happens.
 */
export default function NativeAppBridge() {
  useEffect(() => {
    if (!detectNativeApp()) return;

    let removeListener: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("appUrlOpen", async ({ url }) => {
          try {
            // Close the system-browser sheet first in both branches — the
            // OAuth round-trip and universal links can each arrive from it.
            try {
              const { Browser } = await import("@capacitor/browser");
              await Browser.close();
            } catch { /* nothing open — fine */ }

            // swiftcard://auth-callback?code=… — the native OAuth return leg.
            if (url.startsWith("swiftcard:")) {
              const [{ completeNativeOAuth }, { createBrowserClient }] = await Promise.all([
                import("@/lib/native-auth"),
                import("@supabase/ssr"),
              ]);
              const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
              );
              await completeNativeOAuth(supabase, url);
              return;
            }

            const u = new URL(url);
            // Only ever navigate to our own origin — never let an arbitrary
            // scheme/host steer the webview.
            if (u.hostname === "swiftcard.me" || u.hostname === "www.swiftcard.me") {
              window.location.href = u.pathname + u.search + u.hash;
            }
          } catch { /* malformed URL — ignore */ }
        });
        if (cancelled) { handle.remove(); return; }
        removeListener = () => handle.remove();
      } catch { /* plugin unavailable (older shell build) — universal links still open the app's last page */ }

      // Push-notification taps: lib/apns.ts puts the in-app destination in the
      // payload's custom `url`; navigate there when the user opens one.
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const tapHandle = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const dest = (action?.notification?.data as { url?: string } | undefined)?.url;
          if (typeof dest === "string" && dest.startsWith("/") && !dest.startsWith("//")) {
            window.location.href = dest;
          }
        });
        if (cancelled) { tapHandle.remove(); return; }
        const prev = removeListener;
        removeListener = () => { prev?.(); tapHandle.remove(); };
      } catch { /* push plugin absent — fine */ }
    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, []);

  return null;
}
