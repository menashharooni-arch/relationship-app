"use client";

import { useEffect } from "react";
import { PUSH_TIMEZONE_STORAGE_KEY } from "@/lib/account-state";

// ── Quiet hours only work if we know what "night" means for this person ──────
//
// 10pm–8am is enforced in THEIR timezone, and the zone was only ever learned at
// two moments: the tap that turns push on, and a toggle in Settings. Anyone who
// subscribed before that code existed — or who has since flown to another
// timezone — runs on the UTC fallback instead, which for the east coast means
// their evening (6pm–10pm) is silenced and the small hours are not. One of the
// two people subscribed in production today is in exactly that state.
//
// The browser knows the answer for free. This reports it on any authenticated
// load of the dashboard, which is where the iOS shell lands on every launch, so
// the zone is right for anyone who ever opens the app — no toggle required.
//
// It costs nothing when nothing changed: the last value ACCEPTED by the server
// is remembered per device, so the common case is zero requests. The key is
// person-scoped (lib/account-state.ts) so a second account signing in on the
// same phone reports for itself rather than inheriting the first one's answer.
export default function TimezoneSync() {
  useEffect(() => {
    let timezone = "";
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return; // no Intl zone available — quiet hours keep the server's fallback
    }
    // Same ceiling the API validates against; a zone longer than this is not a
    // zone, and sending it would only be rejected.
    if (!timezone || timezone.length >= 64) return;

    let known: string | null = null;
    try {
      known = localStorage.getItem(PUSH_TIMEZONE_STORAGE_KEY);
    } catch { /* storage blocked (private window) — just report every load */ }
    if (known === timezone) return;

    let alive = true;
    fetch("/api/push/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    })
      .then((res) => {
        // Only remember it once the server has actually stored it. A 401 on a
        // half-expired session must leave this to try again next load.
        if (!alive || !res.ok) return;
        try { localStorage.setItem(PUSH_TIMEZONE_STORAGE_KEY, timezone); } catch { /* blocked */ }
      })
      .catch(() => { /* offline — next load reports it */ });
    return () => { alive = false; };
  }, []);

  return null;
}
