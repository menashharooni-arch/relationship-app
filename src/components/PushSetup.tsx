"use client";

import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "denied" | "subscribed" | "idle";

export default function PushSetup() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    const perm = Notification.permission;
    if (perm === "denied") { setState("denied"); return; }
    if (perm === "granted") {
      checkSubscription();
    } else {
      setState("idle");
    }
  }, []);

  async function checkSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : "idle");
    } catch {
      setState("idle");
    }
  }

  async function enable() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState("denied"); return; }

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }),
      });

      setState("subscribed");
    } catch {
      setState("idle");
    }
  }

  if (state === "loading" || state === "unsupported" || state === "subscribed") return null;

  if (state === "denied") {
    return (
      <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-800/40 rounded-2xl px-5 py-3.5 mb-5">
        <span className="text-base shrink-0">🔕</span>
        <p className="text-amber-300 text-sm">
          Notifications are blocked. Enable them in your browser settings to get instant alerts when someone shares their contact.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 mb-5 bg-blue-950/40 border border-blue-800/40">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-blue-400">
            <path d="M5.85 3.5a.75.75 0 00-1.117-1 9.719 9.719 0 00-2.348 4.876.75.75 0 001.479.248A8.219 8.219 0 015.85 3.5zM19.267 2.5a.75.75 0 10-1.118 1 8.22 8.22 0 011.987 4.124.75.75 0 001.479-.248A9.72 9.72 0 0019.267 2.5z" />
            <path fillRule="evenodd" d="M12 2.25A6.75 6.75 0 005.25 9v.75a8.217 8.217 0 01-2.119 5.52.75.75 0 00.298 1.206c1.544.57 3.16.99 4.831 1.243a3.75 3.75 0 107.48 0 24.583 24.583 0 004.83-1.244.75.75 0 00.298-1.205 8.217 8.217 0 01-2.118-5.52V9A6.75 6.75 0 0012 2.25zM9.75 18c0-.034 0-.067.002-.1a25.05 25.05 0 004.496 0l.002.1a2.25 2.25 0 11-4.5 0z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <p className="text-blue-200 text-sm font-semibold">Get instant contact alerts</p>
          <p className="text-blue-400 text-xs mt-0.5">Tap a notification to save the contact to your phone</p>
        </div>
      </div>
      <button
        onClick={enable}
        className="shrink-0 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full transition-colors"
      >
        Enable
      </button>
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
