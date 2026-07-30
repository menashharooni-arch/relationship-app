"use client";

import { useEffect, useRef } from "react";
import { getVisitorId, markSavedContact } from "@/lib/visitor";
import { SCAN_SAVED_EVENT } from "@/lib/scan-saved-event";

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
  source,
  suppressTracking = false,
}: {
  username: string;
  /**
   * Capture channel, taken from the page's ?source= exactly like every other
   * surface — the QR encodes source=qr_code, so this arrives as "qr_code" and
   * runs through the same SOURCE_LABELS map ("QR code scan"). Hardcoding a new
   * value here would miss that map and print a raw lowercase slug into the
   * owner's notification, which is precisely what happened to swift_links once.
   */
  source: string;
  /** Owner previewing their own card — deliver the contact, record nothing. */
  suppressTracking?: boolean;
}) {
  // Refs, not effect-local flags: the guards must survive an effect re-run.
  // An earlier version put a single `if (fired.current) return` ABOVE the
  // listener setup — so on any second run (StrictMode in dev, or a remount) the
  // cleanup had already torn the timers down and the early return never rebuilt
  // them. The contact was delivered and the ask then never fired at all.
  const delivered = useRef(false);
  const announced = useRef(false);
  const tracked = useRef(false);

  useEffect(() => {
    // ── Hand the phone the contact ───────────────────────────────────────────
    // Small delay so the card paints FIRST. Without it the contact sheet can
    // open over a half-rendered page, and dismissing it reveals a blank card —
    // exactly the problem this component exists to fix.
    let deliverTimer: ReturnType<typeof setTimeout> | undefined;
    if (!delivered.current) {
      deliverTimer = setTimeout(() => {
        delivered.current = true;
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = `/api/card/${encodeURIComponent(username)}/vcard`;
        document.body.appendChild(iframe);
        // Leave it attached briefly so the transfer completes, then clean up.
        setTimeout(() => iframe.remove(), 20_000);
      }, 700);
    }

    // ── Raise the share-back ask once they're back from the OS sheet ─────────
    //
    // The "Add to Contacts" screen belongs to the operating system, so there is
    // no event for "they finished". THREE signals, whichever lands first:
    //   • the tab going hidden and returning — when the sheet is its own surface
    //   • the window regaining focus — how iOS behaves on dismissal
    //   • a timer, because iOS can draw the sheet over Safari WITHOUT ever
    //     marking the page hidden or blurring it, and a signal-only approach
    //     would leave the ask never appearing on iPhone at all
    const announce = () => {
      if (announced.current) return;
      announced.current = true;
      window.dispatchEvent(new CustomEvent(SCAN_SAVED_EVENT));
    };
    let wasHidden = false;
    const onVisibility = () => {
      if (document.hidden) { wasHidden = true; return; }
      if (wasHidden) announce();
    };
    // Focus only counts AFTER the contact has actually been handed over —
    // otherwise a focus event during page load would fire the ask instantly,
    // before the visitor has even seen the contact sheet.
    const onFocus = () => { if (delivered.current) announce(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    // Past the sheet in the common case, still close enough to the save that the
    // ask reads as part of the same moment.
    const askTimer = setTimeout(announce, 4500);

    // Ref-guarded for the same reason as delivery: the effect body now runs on
    // every pass, and recording twice would double the owner's "Contact saved"
    // notification and their saved-contact count off a single scan.
    if (!suppressTracking && !tracked.current) {
      tracked.current = true;
      markSavedContact(username);
      // BYTE-FOR-BYTE the pair SaveContactButton fires. Both routes end at the
      // same moment — the phone's "Add to Contacts" sheet — so the owner must
      // get the identical "Contact saved" bell entry, activity row and CRM
      // dispatch either way. /api/card-events owns all three off
      // downloaded_vcard; sending anything different here would fork the flow.
      fetch("/api/card-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_owner_username: username,
          visitor_id: getVisitorId(),
          event_type: "downloaded_vcard",
          source,
        }),
      }).catch(() => {});
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, event_type: "contact_save" }),
      }).catch(() => {});
    }

    return () => {
      if (deliverTimer) clearTimeout(deliverTimer);
      clearTimeout(askTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [username, source, suppressTracking]);

  return null;
}
