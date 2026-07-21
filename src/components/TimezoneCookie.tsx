"use client";

import { useEffect } from "react";

// Reports the viewer's IANA timezone to the server via a first-party cookie
// (sc_tz) so server-rendered analytics can bucket views by the owner's LOCAL
// calendar day instead of UTC. Purely a display aid — no tracking, no PII, and
// the server falls back to UTC when the cookie is absent (e.g. first paint), so
// this is a safe progressive enhancement. Refreshes only when the value drifts
// (travel / DST) to avoid needless writes.
export default function TimezoneCookie() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      const current = document.cookie
        .split("; ")
        .find((c) => c.startsWith("sc_tz="))
        ?.slice("sc_tz=".length);
      if (current === encodeURIComponent(tz)) return;
      // 1 year, lax, path=/. Not HttpOnly by necessity (set from JS); it carries
      // nothing sensitive — just an IANA zone name the browser already exposes.
      document.cookie = `sc_tz=${encodeURIComponent(tz)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {
      /* Intl unavailable — server keeps its UTC fallback. */
    }
  }, []);
  return null;
}
