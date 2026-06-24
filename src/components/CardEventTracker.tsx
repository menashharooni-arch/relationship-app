"use client";

import { useEffect } from "react";
import { getVisitorId } from "@/lib/visitor";

export default function CardEventTracker({
  username,
  source,
}: {
  username: string;
  source: string;
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

    // Keep existing views table for the dashboard chart
    fetch(`/api/views/${username}`, { method: "POST" }).catch(() => {});
  }, [username, source]);

  return null;
}
