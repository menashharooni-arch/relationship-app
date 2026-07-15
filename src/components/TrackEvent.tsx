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
export default function TrackEvent({ event, props }: { event: EventName; props?: EventProps }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, props);
  }, [event, props]);
  return null;
}
