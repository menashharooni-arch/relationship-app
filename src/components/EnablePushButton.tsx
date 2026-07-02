"use client";

// One-tap push-notification opt-in, reusable anywhere (card-creation success
// step, settings). Registers the service worker, asks permission, and stores
// the subscription so the server can send contact alerts + view milestones.

import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "denied" | "subscribed" | "idle" | "working";

export function usePushState(): [State, () => Promise<boolean>] {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
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
      setState("idle");
      return false;
    }
  }

  return [state, enable];
}

export default function EnablePushButton({ onDone, label = "🔔 Turn on notifications" }: { onDone?: () => void; label?: string }) {
  const [state, enable] = usePushState();

  if (state === "loading") return null;

  if (state === "subscribed") {
    return (
      <div className="w-full text-center text-sm font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-full py-3">
        ✓ Notifications are on
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <p className="text-gray-500 text-xs text-center">
        This browser doesn&apos;t support notifications — open SwiftCard on your phone&apos;s browser and add it to your home screen to get alerts.
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

  return (
    <button
      type="button"
      onClick={async () => { const ok = await enable(); if (ok) onDone?.(); }}
      disabled={state === "working"}
      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-3 rounded-full transition-colors text-sm"
    >
      {state === "working" ? "Turning on…" : label}
    </button>
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
