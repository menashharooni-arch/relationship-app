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

    // ── Native look & motion hook ──────────────────────────────────────────
    // `html.native-app` scopes the Liquid-Glass-inspired CSS layer in
    // globals.css (glass chrome, spring taps, page transitions) to the shell
    // only — the website never gets the class. viewport-fit=cover is injected
    // here rather than in the layout's viewport export so the WEBSITE's layout
    // on notched iPhones is untouched; inside the shell it lets content run
    // edge-to-edge with env(safe-area-inset-*) padding handling the notch.
    document.documentElement.classList.add("native-app");
    try {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
      if (meta && !meta.content.includes("viewport-fit")) {
        meta.content = `${meta.content}, viewport-fit=cover`;
      }
    } catch { /* ignore */ }

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

      // ── Home-screen QR widget data sync ─────────────────────────────────
      // Hand the signed-in user's active card to the SwiftCardWidget extension
      // via the WidgetBridge native plugin (ios/App/App/WidgetBridge.swift),
      // which writes the shared App Group suite and reloads the timeline.
      //
      // ⚠️ Do NOT switch this back to @capacitor/preferences: that plugin's
      // `group` option is only a key prefix on UserDefaults.standard, which
      // lives in the app's own container and is unreadable from a widget
      // extension — the widget would sit on its empty state forever.
      //
      // Honors the dashboard's active-card choice when one is stored.
      //
      // Failures are logged rather than swallowed. The only visible output of
      // this block is the widget itself, so a silent skip is indistinguishable
      // from "working" during device testing — which is how the Preferences
      // version above went unnoticed for weeks. Capacitor forwards console
      // output to the Xcode/simctl console, so these lines are visible there.
      const widgetBridge = (window as unknown as {
        Capacitor?: {
          Plugins?: {
            WidgetBridge?: {
              setCard: (o: Record<string, string>) => Promise<void>;
              clearCard: () => Promise<void>;
            };
          };
        };
      }).Capacitor?.Plugins?.WidgetBridge;

      if (!widgetBridge) {
        // Means the plugin was not registered natively — see MainViewController.
        console.warn("[widget] WidgetBridge plugin unavailable; home-screen widget will not update");
      } else {
        try {
          const res = await fetch("/api/cards", { credentials: "include" });
          const cards = res.ok
            ? ((await res.json()) as { cards?: Array<{ username?: string; name?: string; company?: string }> }).cards
            : undefined;

          let active = cards?.length ? cards[0] : undefined;
          if (active) {
            try {
              const chosen = localStorage.getItem("swiftcard_active_card");
              active = cards!.find((c) => c.username === chosen) ?? active;
            } catch { /* default to first card */ }
          }

          if (active?.username) {
            await widgetBridge.setCard({
              url: `https://swiftcard.me/card/${active.username}?source=widget`,
              name: active.name || "My SwiftCard",
              company: active.company || "",
            });
          } else if (res.status === 401 || res.status === 403 || cards?.length === 0) {
            // Signed out, or the last card was deleted. Without this the widget
            // keeps rendering the previous account's QR on the home screen
            // indefinitely — including after sign-out on a shared or handed-on
            // device, and after the account itself is gone.
            await widgetBridge.clearCard();
          }
        } catch (e) {
          // Offline is normal and fine; a native reject is not. Either way the
          // widget keeps its last data, but say so instead of vanishing.
          console.warn("[widget] sync failed:", e);
        }
      }

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
