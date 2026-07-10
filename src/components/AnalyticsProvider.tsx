"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { PostHog } from "posthog-js";

// Product analytics (PostHog). Completely INERT until NEXT_PUBLIC_POSTHOG_KEY is
// set — with no key the SDK is never even imported (dynamic import below), so
// shipping this changes nothing (no bundle weight, no network, no cookies) until
// you connect an account. Once the key is present it captures pageviews (incl.
// the entry URL's utm/src params) and autocaptured interactions — the data that
// powers signup-funnel + conversion reporting.
//
// The PostHog *project* key is publishable by design (safe in the browser),
// which is why it's a NEXT_PUBLIC_ var.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let ph: PostHog | null = null;
let loading = false;

export default function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    if (!KEY) return; // no key → SDK never loads, stays fully inert

    async function track() {
      if (!ph && !loading) {
        loading = true;
        const mod = await import("posthog-js");
        ph = mod.default;
        ph.init(KEY as string, {
          api_host: HOST,
          // We capture pageviews manually so SPA navigations count exactly once.
          capture_pageview: false,
          capture_pageleave: true,
          autocapture: true,
          // Only spend a person profile on identified users — cheaper, less noise.
          person_profiles: "identified_only",
        });
      }
      // Captures the entry URL on first load (query params and all) and every
      // subsequent route change.
      ph?.capture("$pageview");
    }

    track();
  }, [pathname]);

  return null;
}
