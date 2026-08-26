"use client";

import { useEffect } from "react";
import { getVisitorId, getVisitorInfo } from "@/lib/visitor";
import { whenIdentityReconciled } from "@/lib/account-state";
import { VIEW_VISIT_WINDOW_MS } from "@/lib/view-window";

// Fire-at-most-once-per-visit guard, per (username+surface). A Map of last-fire
// times, not a Set: the old Set was never cleared, so in a long-lived SPA tab
// (card A → card B → back to A hours later) a genuinely new visit was silently
// dropped — including the card_events row that drives the owner's notification.
// Within the visit window it still swallows React strict-mode double-mounts,
// remounts, and back-navigation; past it, a return is a real repeat view and
// fires again (the server dedupes on the same window, so this can never
// overcount — it only stops pointless requests).
const lastFired = new Map<string, number>();

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
    let cancelled = false;

    const fire = async () => {
      // Chrome speculation-rules prerender loads the page (and runs effects)
      // before the visitor ever sees it — that must not count as a view. Wait
      // for the page to become real; an abandoned prerender simply never fires.
      const doc = document as Document & { prerendering?: boolean };
      if (doc.prerendering) {
        await new Promise<void>((resolve) =>
          document.addEventListener("prerenderingchange", () => resolve(), { once: true })
        );
        if (cancelled) return;
      }

      // ── Human gate (owner order 2026-08-26: views "cannot have
      // misinformation"). Three checks, each killing a different bot family
      // that slips past the server's User-Agent list by presenting a normal
      // browser UA:
      //   1. navigator.webdriver — automation frameworks (Playwright,
      //      Puppeteer, Selenium, and crawler renderers built on them).
      //   2. The page must actually be VISIBLE — link-preview renderers
      //      often paint into a hidden surface.
      //   3. A 2.5s dwell, still visible at the end — preview crawlers
      //      snapshot and destroy the page in well under that; a person
      //      reading a card they just opened is always still there.
      // A real visitor who bounces inside 2.5 seconds loses the view — the
      // deliberate trade: an owner must never be told someone viewed their
      // card when no one did.
      if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return;
      if (document.visibilityState !== "visible") {
        await new Promise<void>((resolve) => {
          const onVis = () => { if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", onVis); resolve(); } };
          document.addEventListener("visibilitychange", onVis);
        });
        if (cancelled) return;
      }
      await new Promise((r) => setTimeout(r, 2500));
      if (cancelled || document.visibilityState !== "visible") return;

      // After an account switch, AccountIsolationGuard wipes the previous
      // person's visitor id + identity blob asynchronously — reading them
      // before that wipe lands is how a view got attributed to the previous
      // account's identity. Wait for the first reconcile (bounded; worst case
      // is the old behavior).
      await whenIdentityReconciled();
      if (cancelled) return;

      // Views table for the dashboard chart — keyed by surface so card vs link
      // split. The guard is claimed only AFTER the awaits and the cancel
      // checks: strict-mode's first (immediately-cleaned-up) mount must not
      // spend the slot, or the surviving mount would skip and the view would
      // be lost entirely.
      const viewsKey = viewSurface === "links" ? `${username}__links` : username;
      const last = lastFired.get(viewsKey);
      if (last && Date.now() - last < VIEW_VISIT_WINDOW_MS) return;
      lastFired.set(viewsKey, Date.now());

      const visitorId = getVisitorId();
      // Who is viewing, when we already know. A view used to carry ONLY the
      // browser id, which made it the one event that could never say who it was:
      // the owner's notification had to read "Someone viewed your card" even for
      // a contact they had already met, and the contact's own conversation could
      // only match it by that id. Once a visitor has shared their details with
      // anyone, every later view is attributable.
      const info = getVisitorInfo();
      fetch("/api/card-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_owner_username: username,
          visitor_id: visitorId,
          event_type: "viewed_card",
          source,
          // Which surface was opened — the notification says "your card" vs
          // "your Swift Links", and source alone no longer encodes it now that
          // the links page forwards real ?source= attribution (QR/NFC scans).
          surface: viewSurface,
          visitor_name: info?.name || null,
          visitor_email: info?.email || null,
          visitor_phone: info?.phone || null,
          referrer_url: document.referrer || null,
          device_info: navigator.userAgent.slice(0, 250),
        }),
      }).catch(() => {});

      fetch(`/api/views/${encodeURIComponent(viewsKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, source }),
      }).catch(() => {});
    };

    void fire();
    return () => { cancelled = true; };
  }, [username, source, viewSurface]);

  return null;
}
