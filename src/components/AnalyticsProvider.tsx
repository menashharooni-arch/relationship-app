"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track, trackPageview } from "@/lib/events";

// Route-change hook for product analytics.
//
// trackPageview() records a first-party `page_viewed` on the funnel pages only
// (lib/events FUNNEL_PATHS) and, if NEXT_PUBLIC_POSTHOG_KEY is ever set, a
// PostHog $pageview as well. Without that key the PostHog SDK is never even
// imported — no bundle weight, no third-party cookies.
//
// The SDK init used to live here, with the instance held in a module-scoped
// variable that was never exported — so this file was the ONLY thing in the app
// that could fire an event, and the only event it ever fired was $pageview. All
// of that now lives in lib/events.ts, which every call site can reach.
export default function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    // Captures the entry URL on first load (query params and all) and every
    // subsequent route change.
    trackPageview();
  }, [pathname]);

  // ── "Someone clicked upgrade" ──────────────────────────────────────────────
  // One delegated listener instead of instrumenting the thirteen files that
  // link to /upgrade. That is not only less code: a per-call-site handler is
  // the kind of thing a new upgrade link silently forgets to add, and a funnel
  // step that under-reports is worse than one that doesn't exist. This catches
  // every upgrade link in the product, including ones not written yet.
  //
  // Capture phase and passive: it observes the click and never touches it, so
  // it cannot delay or swallow a navigation.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!el) return;
      const href = el.getAttribute("href") ?? "";
      // Same-origin /upgrade only — an absolute URL to someone else's site
      // that merely ends in "/upgrade" is not our funnel.
      if (href === "/upgrade" || href.startsWith("/upgrade?")) {
        track("upgrade_started", { placement: window.location.pathname });
      }
    }
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
