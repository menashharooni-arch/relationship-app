"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageview } from "@/lib/events";

// Product analytics (PostHog). Completely INERT until NEXT_PUBLIC_POSTHOG_KEY is
// set — with no key the SDK is never even imported, so shipping this changes
// nothing (no bundle weight, no network, no cookies) until you connect an
// account. Once the key is present it captures pageviews (incl. the entry URL's
// utm/src params) and autocaptured interactions.
//
// The SDK init used to live here, with the instance held in a module-scoped
// variable that was never exported — so this file was the ONLY thing in the app
// that could fire an event, and the only event it ever fired was $pageview. All
// of that now lives in lib/events.ts, which every call site can reach; this
// component is just the route-change hook.
export default function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    // Captures the entry URL on first load (query params and all) and every
    // subsequent route change. No-op without a key.
    trackPageview();
  }, [pathname]);

  return null;
}
