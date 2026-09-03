"use client";

// One-tap push-notification opt-in, reusable anywhere (card-creation success
// step, settings). Registers the service worker, asks permission, and stores
// the subscription so the server can send contact alerts + view milestones.

import { useEffect, useState } from "react";
import { detectNativeApp } from "@/lib/platform";

type State = "loading" | "unsupported" | "ios-install" | "native" | "denied" | "subscribed" | "idle" | "working" | "error";

// iOS (iPhone/iPad) only allows web push for a site that's been ADDED TO THE
// HOME SCREEN and opened from there (standalone). In a normal Safari tab the
// PushManager API doesn't even exist — so we detect this case and guide the
// user to install, instead of a dead-end "not supported".
//
// NATIVE (Capacitor iOS shell): web push doesn't exist inside WKWebView, and the
// "Add to Home Screen" guidance is impossible there (no Safari share button) —
// showing it inside a native app reads as broken (App Review 2.1). When the
// shell ships the PushNotifications plugin, native gets REAL APNs push (the
// toggle below registers the device token as an "apns:<token>" endpoint and
// lib/apns.ts delivers). A plugin-less shell build falls back to a quiet,
// honest not-available state with NO instructions. Web is byte-identical.
function nativePushAvailable(): boolean {
  try {
    const cap = (window as unknown as {
      Capacitor?: { isPluginAvailable?: (name: string) => boolean };
    }).Capacitor;
    return !!cap?.isPluginAvailable?.("PushNotifications");
  } catch {
    return false;
  }
}

const APNS_ENDPOINT_KEY = "swiftcard_apns_endpoint";
// Which account enabled push on this device — NativeAppBridge's silent
// launch-time token refresh only re-registers when the CURRENT session matches
// this, so a rotated APNs token gets rebound for the user who opted in and
// never for anyone else. Cleared by unbindDevicePush.
const PUSH_UID_KEY = "swiftcard_push_uid";

// The session uid, for stamping PUSH_UID_KEY. Local cookie decode, no network;
// null (skip the stamp) on any failure — the stamp is an optimization, not a
// gate on enabling push.
async function sessionUid(): Promise<string | null> {
  try {
    const { createBrowserClient } = await import("@supabase/ssr");
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// Push failures are invisible by nature: nobody files a bug for a toggle that
// flicks back, and the user-facing copy has to stay vague. Ship the real reason
// to the server so the next one is diagnosable from a log instead of a build
// bisect. Best-effort — never let reporting a failure cause one.
function reportPushFailure(message: string) {
  try {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        context: "push-enable",
        url: typeof location !== "undefined" ? location.pathname : "",
      }),
      keepalive: true,
    }).catch(() => { /* ignore */ });
  } catch { /* ignore */ }
}

function detectEnv() {
  if (typeof window === "undefined") return { supported: false, iosNeedsInstall: false, native: false };
  if (detectNativeApp()) return { supported: false, iosNeedsInstall: false, native: true };
  const ua = navigator.userAgent || "";
  const isIOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const hasApis =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return { supported: hasApis, iosNeedsInstall: isIOS && !standalone && !hasApis, native: false };
}

// Why the last enable failed, when the honest message is not "try again".
// "old-build": the binary itself can't register (no aps-environment
// entitlement) — the App Store 1.0.0 build shipped that way, and no amount of
// re-tapping fixes it; only an update does.
type FailReason = "old-build" | null;

export function usePushState(): [State, () => Promise<boolean>, FailReason] {
  const [state, setState] = useState<State>("loading");
  const [reason, setReason] = useState<FailReason>(null);

  useEffect(() => {
    const { supported, iosNeedsInstall, native } = detectEnv();
    if (native) {
      if (!nativePushAvailable()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time environment check on mount
        setState("native");
        return;
      }
      // Native APNs path: subscribed = OS permission granted AND we registered
      // a token from this device before.
      (async () => {
        try {
          const { PushNotifications } = await import("@capacitor/push-notifications");
          const perm = await PushNotifications.checkPermissions();
          if (perm.receive === "denied") { setState("denied"); return; }
          let stored: string | null = null;
          try { stored = localStorage.getItem(APNS_ENDPOINT_KEY); } catch { /* ignore */ }
          setState(perm.receive === "granted" && stored ? "subscribed" : "idle");
        } catch {
          setState("native");
        }
      })();
      return;
    }
    if (!supported) {
       
      setState(iosNeedsInstall ? "ios-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") { setState("denied"); return; }
    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setState(sub ? "subscribed" : "idle"))
        .catch(() => setState("idle"));
    } else {
      setState("idle");
    }
  }, []);

  async function enable(): Promise<boolean> {
    setState("working");
    setReason(null);

    // Native APNs path (Capacitor shell with the PushNotifications plugin).
    if (detectNativeApp() && nativePushAvailable()) {
      let handles: { remove: () => void }[] = [];
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") { setState("denied"); return false; }

        // Both listeners must be ATTACHED before register() is called, and the
        // attach is asynchronous (it crosses the JS↔native bridge). The plugin
        // fires "registration"/"registrationError" with retainUntilConsumed
        // FALSE — unlike "pushNotificationActionPerformed" — so an event that
        // arrives before the listener exists is dropped and never redelivered.
        // Awaiting the handles is the whole difference between a token and a
        // silent 15-second timeout.
        let settle: ((r: { token?: string; error?: string }) => void) | null = null;
        const outcome = new Promise<{ token?: string; error?: string }>((resolve) => { settle = resolve; });
        const done = (r: { token?: string; error?: string }) => { settle?.(r); settle = null; };

        handles.push(await PushNotifications.addListener("registration", (t) => done({ token: t.value })));
        handles.push(await PushNotifications.addListener("registrationError", (e) =>
          done({ error: String((e as { error?: unknown })?.error ?? "registration failed") })));

        await PushNotifications.register();

        const timeout = new Promise<{ token?: string; error?: string }>((resolve) =>
          setTimeout(() => resolve({ error: "timed out waiting for an APNs token" }), 15_000));
        const result = await Promise.race([outcome, timeout]);

        if (!result.token) {
          // The reason matters and used to be discarded. "no valid
          // aps-environment entitlement string found for application" is a
          // BUILD defect, not a connection problem, and it looked identical to
          // being offline for as long as this was swallowed.
          reportPushFailure(`native registration failed: ${result.error ?? "unknown"}`);
          if (/aps-environment/.test(result.error ?? "")) setReason("old-build");
          setState("error");
          return false;
        }

        const endpoint = `apns:${result.token}`;
        // Same table/route as web push; p256dh/auth are web-crypto fields that
        // don't exist for APNs — namespaced placeholders satisfy the schema.
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint, p256dh: "apns", auth: "apns" }),
        });
        if (!res.ok) {
          reportPushFailure(`subscribe returned ${res.status}`);
          setState("error");
          return false;
        }
        try {
          localStorage.setItem(APNS_ENDPOINT_KEY, endpoint);
          const uid = await sessionUid();
          if (uid) localStorage.setItem(PUSH_UID_KEY, uid);
        } catch { /* ignore */ }
        setState("subscribed");
        return true;
      } catch (e) {
        reportPushFailure(`native enable threw: ${e instanceof Error ? e.message : String(e)}`);
        setState("error");
        return false;
      } finally {
        // Every tap used to leave two more live listeners behind.
        for (const h of handles) { try { h.remove(); } catch { /* ignore */ } }
        handles = [];
      }
    }

    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState("denied"); return false; }

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }),
      });

      setState("subscribed");
      return true;
    } catch {
      // Never fail silently — the button returning to "idle" with no message
      // reads as broken. Show a retryable error state instead.
      setState("error");
      return false;
    }
  }

  return [state, enable, reason];
}

// The on/off switch itself.
function Switch({ on, busy, onClick }: { on: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Push notifications"
      disabled={busy}
      onClick={onClick}
      className="relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-60"
      style={{ background: on ? "#059669" : "#4b5563" }}
    >
      <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all" style={{ left: on ? "22px" : "2px" }} />
    </button>
  );
}

export default function EnablePushButton({
  onDone,
}: {
  onDone?: () => void;
  /** @deprecated kept for call-site compatibility — always a toggle now. */
  label?: string;
  allowDisable?: boolean;
}) {
  const [state, enable, reason] = usePushState();
  const [busyOff, setBusyOff] = useState(false);
  const [forcedOff, setForcedOff] = useState(false);

  // Unsubscribe this device: browser subscription + our server record.
  async function disable() {
    setBusyOff(true);
    try {
      // Native APNs path: delete the server record (iOS has no client-side
      // "unregister"; removing the endpoint stops all sends to this device).
      if (detectNativeApp()) {
        let endpoint: string | null = null;
        try { endpoint = localStorage.getItem(APNS_ENDPOINT_KEY); } catch { /* ignore */ }
        if (endpoint) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          }).catch(() => {});
          try { localStorage.removeItem(APNS_ENDPOINT_KEY); } catch { /* ignore */ }
        }
        // Without this the launch-time silent re-register (NativeAppBridge)
        // saw permission granted + a matching uid and turned push back ON.
        try { localStorage.removeItem(PUSH_UID_KEY); } catch { /* ignore */ }
        setForcedOff(true);
        setBusyOff(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
      setForcedOff(true); // usePushState computed once on mount — reflect the change locally
    } catch { /* leave state as-is; user can retry */ }
    setBusyOff(false);
  }

  if (state === "loading") return null;

  // Native Capacitor shell: web push can't work in WKWebView and the install
  // guidance below is impossible there. A quiet, honest note — no dead-end
  // instructions, no broken toggle.
  if (state === "native") {
    return (
      <p className="text-gray-500 text-xs text-center">
        Push notifications aren&apos;t available in this version of the app — you&apos;ll still see new contacts and activity here and by email.
      </p>
    );
  }

  // iPhone/iPad in a Safari tab: guide them to install, don't dead-end.
  if (state === "ios-install") {
    return (
      <div className="w-full rounded-2xl border border-blue-800/40 bg-blue-950/30 px-4 py-3 text-left">
        <p className="text-blue-200 text-sm font-semibold">Turn on notifications on iPhone</p>
        <p className="text-blue-300/80 text-xs mt-1.5 leading-relaxed">
          Tap the <strong>Share</strong> button, choose <strong>Add to Home Screen</strong>, then open SwiftCard from your home screen and switch notifications on here.
        </p>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <p className="text-gray-500 text-xs text-center">
        This browser doesn&apos;t support push notifications. Try Chrome on Android, or add SwiftCard to your home screen on iPhone.
      </p>
    );
  }

  if (state === "denied") {
    // iOS remembers a "Don't Allow" forever and the app cannot re-prompt, so
    // this message is the ONLY way back. Sending an iPhone owner to "browser
    // settings" — which is what this said, because the whole component was
    // written for the web first — is a dead end inside the app: there is no
    // browser UI to open. Name the real path instead.
    //
    // Safe to branch on detectNativeApp() at render: "denied" is only reachable
    // after usePushState's effect has run, so this never renders on the server
    // or on the hydrating first paint.
    if (detectNativeApp()) {
      return (
        <p className="text-amber-400 text-xs text-center leading-relaxed">
          Notifications are turned off for SwiftCard. Open the iPhone{" "}
          <strong>Settings</strong> app → <strong>SwiftCard</strong> →{" "}
          <strong>Notifications</strong>, switch <strong>Allow Notifications</strong> on,
          then come back here.
        </p>
      );
    }
    return (
      <p className="text-amber-400 text-xs text-center">
        Notifications are blocked for this site — enable them in your browser settings, then reload.
      </p>
    );
  }

  const isOn = state === "subscribed" && !forcedOff;
  const busy = state === "working" || busyOff;

  async function toggle() {
    if (isOn) { await disable(); return; }
    const ok = await enable();
    if (ok) { setForcedOff(false); onDone?.(); }
  }

  return (
    <div className="space-y-2">
      <div className="w-full flex items-center justify-between gap-3 bg-gray-800/50 border border-gray-700/60 rounded-2xl py-2.5 px-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-100">
            {isOn ? "Push notifications" : "Turn on Push notifications!"}
          </p>
          {(busy || isOn) && (
            <p className="text-[11px] text-gray-500">
              {busy ? "One moment…" : "On for this device"}
            </p>
          )}
        </div>
        <Switch on={isOn} busy={busy} onClick={toggle} />
      </div>
      {state === "error" && reason === "old-build" && (
        <p className="text-amber-400 text-xs text-center leading-relaxed">
          This version of SwiftCard can&apos;t receive notifications yet. Update the app from the App Store, then come back and tap the switch again.
        </p>
      )}
      {state === "error" && reason !== "old-build" && (
        <p className="text-amber-400 text-xs text-center">Couldn&apos;t turn notifications on — check your connection and tap the switch again.</p>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer;
}
