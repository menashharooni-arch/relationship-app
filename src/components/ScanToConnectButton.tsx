"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCard from "@/components/QRCard";

// Phone-only control under the card in the dashboard's Your Card box.
//
// On a phone the PNG download was the wrong default: saving an image you then
// have to go find in Files is a worse way to hand someone your card than
// holding up a QR they scan. The download hasn't gone anywhere — it moved into
// "Other ways to share", which is also where the QR IMAGE used to live. The two
// swapped places. On desktop the download stays put: you can't hold a monitor
// up to someone's camera.
//
// The URL must arrive already tagged (lib/share-source) so scans attribute to
// "QR code scan" rather than "Card link".
export default function ScanToConnectButton({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  // Escape closes it too — on a computer that is the expected way out of an
  // overlay, and it had none (2026-09-23 free-account review).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full py-2 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="w-3.5 h-3.5" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 14h2v2h-2zM18 14h3v2M21 18v3M17 18h2v3M14 18v3" />
        </svg>
        Scan to connect (QR)
      </button>

      {/* Portaled to <body>: an ancestor with a transform becomes the containing
          block for position:fixed and would cage this overlay inside the card
          panel. CardPreviewDownload puts a scale() transform on the card node a
          few levels up, so this is not hypothetical.
          Above the guided tour (masks z-[9998], tooltip z-[10000]): the tour's
          "Your SwiftCard — try it" step invites exactly this tap, and at z-100
          the QR opened UNDER the tour's mask — visible only through the
          spotlight hole, its tap-outside-to-close area swallowed by the mask,
          and still covering the card for every step after it. */}
      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Scan to connect"
          className="fixed inset-0 z-[10001] flex flex-col items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="relative w-full max-w-xs">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute -top-3 -right-3 z-20 w-8 h-8 rounded-full bg-gray-900 border border-gray-700 text-gray-300 hover:text-white text-xl leading-none flex items-center justify-center transition-colors"
            >
              ×
            </button>
            {/* The same panel the share modal shows on desktop — it already
                carries the "Scan to connect" wordmark, so there is no header
                here repeating it. */}
            <QRCard url={url} />
          </div>
          {/* Under the card, not pinned to the screen bottom: there it sat on
              the app's tab bar, printed across its labels. */}
          <p className="mt-4 rounded-full bg-black/60 px-3 py-1 text-white/80 text-xs">Tap outside to close</p>
        </div>,
        document.body,
      )}
    </>
  );
}
