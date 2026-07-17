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

export function usePushState(): [State, () => Promise<boolean>] {
  const [state, setState] = useState<State>("loading");

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

    // Native APNs path (Capacitor shell with the PushNotifications plugin).
    if (detectNativeApp() && nativePushAvailable()) {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") { setState("denied"); return false; }

        const token = await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("registration timeout")), 15_000);
          PushNotifications.addListener("registration", (t) => { clearTimeout(timer); resolve(t.value); });
          PushNotifications.addListener("registrationError", (e) => { clearTimeout(timer); reject(new Error(String(e?.error ?? "registration failed"))); });
          PushNotifications.register().catch((e) => { clearTimeout(timer); reject(e); });
        });

        const endpoint = `apns:${token}`;
        // Same table/route as web push; p256dh/auth are web-crypto fields that
        // don't exist for APNs — namespaced placeholders satisfy the schema.
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint, p256dh: "apns", auth: "apns" }),
        });
        if (!res.ok) { setState("error"); return false; }
        try { localStorage.setItem(APNS_ENDPOINT_KEY, endpoint); } catch { /* ignore */ }
        setState("subscribed");
        return true;
      } catch {
        setState("error");
        return false;
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

  return [state, enable];
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
  const [state, enable] = usePushState();
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
          <p className="text-sm font-semibold text-gray-100">Push notifications</p>
          <p className="text-[11px] text-gray-500">
            {busy ? "One moment…" : isOn ? "On for this device" : "Get a buzz when someone shares their info"}
          </p>
        </div>
        <Switch on={isOn} busy={busy} onClick={toggle} />
      </div>
      {state === "error" && (
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
