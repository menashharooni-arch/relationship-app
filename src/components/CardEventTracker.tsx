"use client";

import { useEffect } from "react";
import { getVisitorId } from "@/lib/visitor";

export default function CardEventTracker({
  username,
  source,
  viewSurface = "card",
}: {
  username: string;
  source: string;
  // "card" tracks views under the plain username; "links" tracks the Swift Link
  // under "<username>__links" so the dashboard can show them separately.
  viewSurface?: "card" | "links";
}) {
  useEffect(() => {
    const visitorId = getVisitorId();
    fetch("/api/card-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_owner_username: username,
        visitor_id: visitorId,
        event_type: "viewed_card",
        source,
        referrer_url: document.referrer || null,
        device_info: navigator.userAgent.slice(0, 250),
      }),
    }).catch(() => {});

    // Views table for the dashboard chart — keyed by surface so card vs link split.
    const viewsKey = viewSurface === "links" ? `${username}__links` : username;
    fetch(`/api/views/${encodeURIComponent(viewsKey)}`, { method: "POST" }).catch(() => {});
  }, [username, source, viewSurface]);

  return null;
}
