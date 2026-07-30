"use client";

import { useEffect, useRef } from "react";
import { getVisitorId, markSavedContact } from "@/lib/visitor";

// ── The QR-scan landing behaviour ────────────────────────────────────────────
//
// Scanning the desktop "Scan QR code" popup used to send the phone straight to
// the raw .vcf endpoint. The contact sheet appeared, but the moment it was
// dismissed the visitor was staring at a blank page holding a downloaded file —
// the card they'd just scanned was nowhere.
//
// So the QR now lands on the CARD PAGE with ?save=1, and this component fires
// the vCard from there. The phone stacks its native "Add to Contacts" sheet on
// top, and when that's dismissed the full SwiftCard is already loaded
// underneath, ready to scroll.
//
// Delivery is a hidden IFRAME rather than window.location: navigating the top
// frame to a text/vcard URL leaves Android Chrome on a blank tab (it treats the
// navigation as a download and the page it came from is gone). An iframe hands
// the file over while the card page keeps the viewport — same trick the wallet
// pass uses.
export default function ScanSaveContact({
  username,
  suppressTracking = false,
}: {
  username: string;
  /** Owner previewing their own card — deliver the contact, record nothing. */
  suppressTracking?: boolean;
}) {
  const fired = useRef(false);

  useEffect(() => {
    // StrictMode double-invokes effects in dev; a second fire would hand the
    // phone two contact sheets.
    if (fired.current) return;
    fired.current = true;

    // Small delay so the card paints FIRST. Without it the contact sheet can
    // open over a half-rendered page, and dismissing it reveals a blank card —
    // exactly the problem this component exists to fix.
    const timer = setTimeout(() => {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = `/api/card/${encodeURIComponent(username)}/vcard`;
      document.body.appendChild(iframe);
      // Leave it attached briefly so the transfer completes, then clean up.
      setTimeout(() => iframe.remove(), 20_000);
    }, 700);

    if (!suppressTracking) {
      markSavedContact(username);
      // Same event the Save Contact button records, so a QR save shows up in
      // the owner's activity as "saved your contact" like every other save
      // rather than silently not existing.
      fetch("/api/card-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_owner_username: username,
          visitor_id: getVisitorId(),
          event_type: "downloaded_vcard",
          source: "qr_scan",
        }),
      }).catch(() => {});
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, event_type: "contact_save" }),
      }).catch(() => {});
    }

    return () => clearTimeout(timer);
  }, [username, suppressTracking]);

  return null;
}
