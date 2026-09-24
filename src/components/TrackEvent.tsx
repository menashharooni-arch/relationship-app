"use client";

import { useEffect, useRef } from "react";
import { track, type EventName, type EventProps } from "@/lib/events";

// Fires one event on mount. For server components that need to record a
// milestone the user has ALREADY reached by loading the page — checkout success
// being the obvious one, since the payment happened on Stripe's side and the
// redirect back is the first moment we can see it.
//
// Guarded against React's double-invoke in dev StrictMode so the funnel doesn't
// double-count locally.
export default function TrackEvent({ event, props, clearParams }: {
  event: EventName;
  props?: EventProps;
  /** Query params that MARK the milestone — removed from the address once it
   *  is recorded, so a reload neither records it again nor re-shows whatever
   *  the server renders for it ("?upgraded=true" re-fired checkout_completed
   *  and "Welcome to Pro!" on every refresh). */
  clearParams?: string[];
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, props);
    if (clearParams?.length) {
      try {
        const u = new URL(window.location.href);
        let changed = false;
        for (const p of clearParams) if (u.searchParams.has(p)) { u.searchParams.delete(p); changed = true; }
        if (changed) window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
      } catch { /* the address stays as it is */ }
    }
  }, [event, props, clearParams]);
  return null;
}
