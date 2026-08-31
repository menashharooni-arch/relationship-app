"use client";

import { useEffect } from "react";
import { safeNextPath } from "@/lib/safe-next";
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

    // Drop the native splash the moment this page has painted (two frames in
    // so the first paint is actually on screen). Any page — login, dashboard,
    // a deep link — so the splash never outlives the content behind it.
    //
    // BACKUP PATH ONLY on a cold launch. This effect runs after hydration,
    // which on a remote-URL shell is 1-3s in, and the launch animation cannot
    // wait that long to start — so the splash overlay hands off from its own
    // inline script two frames after it paints (src/lib/splash/markup.html).
    // This call stays for every path that renders no overlay (an in-app hard
    // navigation, a shell build whose HTML predates it) and is a no-op when
    // the splash is already down.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      import("@capacitor/splash-screen")
        .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 180 }))
        .catch(() => { /* older shell without the plugin: auto-hide covers it */ });
    }));
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

            // swiftcard://linkedin-callback?status=…&next=… — the LinkedIn
            // headshot import's return leg. It has no code to exchange (the
            // callback route already did the token work server-side); all that
            // is left is to put the WEBVIEW back where the user started, which
            // is what makes the imported photo appear in the editor they came
            // from. Checked before the auth branch because both are swiftcard:
            // URLs and completeNativeOAuth would reject this one.
            // Integration OAuth return legs. Each finishes server-side (tokens
            // are already stored); all that is left is to put the WEBVIEW back
            // on Settings so the UI reflects the connection the user just made.
            // Matched BEFORE the auth branch because both are swiftcard: URLs
            // and completeNativeOAuth would reject these (no code to exchange).
            // One branch for every provider return: swiftcard://<provider>-callback.
            // Salesforce shipped without its own branch and fell through to the
            // auth handler below, which sent a signed-in user to /login.
            const provider = url.match(/^swiftcard:\/\/([a-z]+)-callback/)?.[1];
            if (provider && provider !== "auth") {
              const q = new URL(url).searchParams;
              const nextRaw = q.get("next") ?? "";
              // Same-origin relative paths only — an appUrlOpen payload is
              // attacker-reachable (any app can open a swiftcard:// URL), so it
              // must never steer the webview off our own origin.
              const next =
                safeNextPath(nextRaw) ?? "/settings/flows";
              const sep = next.includes("?") ? "&" : "?";
              window.location.href =
                `${next}${sep}integration=${provider}&status=${encodeURIComponent(q.get("status") ?? "error")}`;
              return;
            }

            // swiftcard://auth-callback?code=… — the native OAuth return leg.
            if (url.startsWith("swiftcard:")) {
              // Paint "Signing you in…" BEFORE the code exchange. The webview
              // behind the browser sheet is still showing the login form, so
              // without this the user watches Google succeed and then lands
              // back on "Create account" for the seconds the exchange +
              // /onboarding take — which reads as a failed sign-in.
              showAuthOverlay();
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
      // Registered BEFORE the widget sync below (which awaits a network fetch)
      // — a tap that launches the app from cold start fires as soon as the
      // listener exists, and every second of delay is a window where the tap
      // silently does nothing.
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const tapHandle = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const dest = (action?.notification?.data as { url?: string } | undefined)?.url;
          if (typeof dest !== "string") return;
          // Senders pass ABSOLUTE urls (`${APP_URL}/dashboard?card=…`) — the
          // old relative-only guard rejected every one of them, so tapping a
          // push never navigated. Accept our own origin and strip it to a
          // path; still never let a foreign origin steer the webview.
          let path: string | null = null;
          if (safeNextPath(dest)) {
            path = dest;
          } else {
            try {
              const u = new URL(dest);
              if (u.hostname === "swiftcard.me" || u.hostname === "www.swiftcard.me") {
                path = u.pathname + u.search + u.hash;
              }
            } catch { /* not a URL — ignore */ }
          }
          if (path) window.location.href = path;
        });
        if (cancelled) { tapHandle.remove(); return; }
        const prevTap = removeListener;
        removeListener = () => { prevTap?.(); tapHandle.remove(); };

        // ── Silent token refresh ──────────────────────────────────────────
        // iOS rotates APNs tokens (OS upgrade, backup restore) and register()
        // is otherwise only called from the user-initiated enable button — a
        // rotated token meant pushes silently stopped until the user toggled
        // the setting again. On each launch, IF this device's push binding
        // belongs to the CURRENT signed-in user and permission is already
        // granted, re-register and re-upsert the (possibly new) token. Never
        // prompts, never binds an account that didn't opt in itself.
        try {
          const perm = await PushNotifications.checkPermissions();
          const pushUid = localStorage.getItem("swiftcard_push_uid");
          if (perm.receive === "granted" && pushUid) {
            const { createBrowserClient } = await import("@supabase/ssr");
            const supabase = createBrowserClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id && session.user.id === pushUid) {
              const regHandle = await PushNotifications.addListener("registration", (t) => {
                const endpoint = `apns:${t.value}`;
                fetch("/api/push/subscribe", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ endpoint, p256dh: "apns", auth: "apns" }),
                }).then((r) => {
                  if (r.ok) { try { localStorage.setItem("swiftcard_apns_endpoint", endpoint); } catch { /* ignore */ } }
                }).catch(() => { /* offline — next launch retries */ });
              });
              const prevReg = removeListener;
              removeListener = () => { prevReg?.(); regHandle.remove(); };
              await PushNotifications.register();
            }
          }
        } catch { /* refresh is best-effort — enable button remains the fallback */ }
      } catch { /* push plugin absent — fine */ }

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
              url: `https://swiftcard.me/${active.username}?source=widget`,
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

    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, []);

  return null;
}


/**
 * Full-screen "Signing you in…" cover for the OAuth return leg.
 *
 * Deliberately raw DOM, not React state: this fires from a Capacitor event
 * listener while an arbitrary page is mounted (usually /login), and it must
 * appear on the very next frame. It is removed by the navigation that
 * follows; a 20s failsafe clears it if the exchange never resolves, so a
 * network failure can never leave the app stuck behind a cover.
 */
function showAuthOverlay(): void {
  try {
    if (document.getElementById("sc-auth-overlay")) return;
    const el = document.createElement("div");
    el.id = "sc-auth-overlay";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;" +
      "justify-content:center;gap:14px;background:#030712;color:#e5e7eb;font:600 15px/1.4 system-ui,-apple-system,sans-serif";
    el.innerHTML =
      '<div style="width:34px;height:34px;border:3px solid rgba(255,255,255,.18);border-top-color:#3b82f6;' +
      'border-radius:50%;animation:sc-auth-spin .8s linear infinite"></div><div>Signing you in…</div>' +
      '<style>@keyframes sc-auth-spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(el);
    setTimeout(() => { document.getElementById("sc-auth-overlay")?.remove(); }, 20000);
  } catch { /* overlay is a nicety — never block the sign-in */ }
}
