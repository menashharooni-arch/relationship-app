"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getVisitorId } from "@/lib/visitor";

// First-party website analytics tracker for the MARKETING site. Records a
// pageview per route change and the time spent on each page. Deliberately does
// NOT track the signed-in app, the admin portal, or shared card/links pages —
// those are either private or already tracked by card_views. Fully first-party:
// one same-origin POST, no third party, no cookies of its own.

// App / private / already-tracked route prefixes to skip. Everything else is
// "the website" (home, pricing, products, preview, templates, contact, …).
const SKIP_PREFIXES = [
  "/dashboard", "/admin", "/contacts", "/share", "/settings", "/cards",
  "/office", "/onboarding", "/login", "/checkout", "/welcome", "/profile",
  "/card/", "/links/", "/auth", "/r/", "/join", "/api", "/grow",
];

const SESSION_KEY = "sc_site_session";
const SESSION_TS_KEY = "sc_site_session_ts";
const SESSION_GAP_MS = 30 * 60 * 1000; // 30-min inactivity → new session

function currentSessionId(): string {
  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem(SESSION_TS_KEY) || 0);
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id || now - last > SESSION_GAP_MS) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    sessionStorage.setItem(SESSION_TS_KEY, String(now));
    return id;
  } catch {
    return "nostore";
  }
}

function tracked(path: string): boolean {
  return path === "/" || !SKIP_PREFIXES.some((p) => path === p || path.startsWith(p));
}

export default function SiteAnalytics() {
  const pathname = usePathname();
  // The view id + accumulated engaged time for the CURRENT page, so the
  // duration beacon can update the right row when we leave it.
  const viewIdRef = useRef<string | null>(null);
  const shownAtRef = useRef<number>(0);
  const sentDurationRef = useRef(false);

  useEffect(() => {
    if (!tracked(pathname)) return;

    const id = crypto.randomUUID();
    viewIdRef.current = id;
    shownAtRef.current = Date.now();
    sentDurationRef.current = false;

    // Record the view. keepalive so it isn't cancelled if the user navigates
    // away immediately.
    fetch("/api/site-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        id,
        visitorId: getVisitorId(),
        sessionId: currentSessionId(),
        path: pathname,
        referrer: document.referrer || null,
      }),
    }).catch(() => { /* analytics must never surface an error to the visitor */ });

    const sendDuration = () => {
      if (sentDurationRef.current || !viewIdRef.current) return;
      const durationMs = Date.now() - shownAtRef.current;
      if (durationMs < 1000) return; // sub-second: a bounce/misclick, not a read
      sentDurationRef.current = true;
      const payload = JSON.stringify({ event: "duration", id: viewIdRef.current, durationMs });
      // sendBeacon survives the page unloading; fetch+keepalive is the fallback.
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/site-view", new Blob([payload], { type: "application/json" }));
          return;
        }
      } catch { /* fall through */ }
      fetch("/api/site-view", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: payload }).catch(() => {});
    };

    // Flush the duration when the page is hidden (tab switch, close) or on the
    // next route change (the effect cleanup below).
    const onHide = () => { if (document.visibilityState === "hidden") sendDuration(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", sendDuration);

    return () => {
      sendDuration();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", sendDuration);
    };
  }, [pathname]);

  return null;
}
