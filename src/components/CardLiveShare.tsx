"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { track, trackCta } from "@/lib/events";

// The share panel shown the moment a card goes live.
//
// The publish screen used to be a dead end: a headline, the slug as PLAIN TEXT
// (not even selectable as a link), a notifications prompt, and "Continue to
// dashboard". Every asset a new card needs — the link, the QR, the wallet pass —
// existed, but only on the dashboard and /share, i.e. only AFTER the user had
// already left the one moment they most want to hand the card to someone.
//
// Deliberately not a second copy of the dashboard's share UI: this is the
// narrow, high-intent version (link, QR, wallet) with one primary action.

export default function CardLiveShare({ username, appUrl, walletEnabled }: {
  username: string;
  appUrl: string;
  walletEnabled: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const cardUrl = `${appUrl}/card/${username}`;

  async function shareNative() {
    trackCta("share_my_card", "card_live", { method: "native" });
    // navigator.share needs a user gesture and isn't everywhere — fall back to
    // copy rather than showing a button that does nothing.
    try {
      if (navigator.share) {
        await navigator.share({ title: "My SwiftCard", url: cardUrl });
        track("card_shared", { method: "native" });
        return;
      }
    } catch {
      return; // user dismissed the sheet — not an error, don't fall through
    }
    copyLink();
  }

  function copyLink() {
    try {
      navigator.clipboard?.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track("card_shared", { method: "copy_link" });
    } catch { /* older browsers — the URL is on screen to copy by hand */ }
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${username}-swiftcard-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    track("qr_downloaded", { method: "png" });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={shareNative}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3 rounded-full transition-colors"
      >
        Share my card
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold py-2.5 rounded-full transition-colors"
        >
          {copied ? "Link copied ✓" : "Copy card link"}
        </button>
        <button
          type="button"
          onClick={() => { setShowQr((v) => !v); if (!showQr) trackCta("show_qr", "card_live"); }}
          aria-expanded={showQr}
          className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold py-2.5 rounded-full transition-colors"
        >
          {showQr ? "Hide QR code" : "Show QR code"}
        </button>
      </div>

      {showQr && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-center">
          <div ref={qrRef} className="bg-white rounded-xl p-3 inline-block">
            <QRCodeCanvas value={cardUrl} size={148} />
          </div>
          <button
            type="button"
            onClick={downloadQr}
            className="mt-3 w-full bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold py-2.5 rounded-full transition-colors"
          >
            Download QR code
          </button>
        </div>
      )}

      {walletEnabled && (
        <a
          href={`/api/wallet/pass?card=${encodeURIComponent(username)}`}
          onClick={() => track("wallet_pass_added", { method: "apple_wallet" })}
          className="w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white bg-black hover:bg-gray-900 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path d="M17.05 12.54c-.02-2.06 1.68-3.05 1.76-3.1-.96-1.4-2.46-1.6-2.99-1.62-1.27-.13-2.48.75-3.13.75-.64 0-1.64-.73-2.7-.71-1.39.02-2.67.81-3.38 2.05-1.44 2.5-.37 6.2 1.03 8.23.69.99 1.51 2.11 2.58 2.07 1.04-.04 1.43-.67 2.68-.67 1.25 0 1.6.67 2.7.65 1.11-.02 1.82-1.01 2.5-2.01.79-1.15 1.11-2.26 1.13-2.32-.02-.01-2.17-.83-2.19-3.29zM15.1 6.29c.57-.69.95-1.65.85-2.6-.82.03-1.81.54-2.39 1.23-.52.61-.98 1.58-.86 2.51.91.07 1.84-.46 2.4-1.14z" />
          </svg>
          Add to Apple Wallet
        </a>
      )}

      <a
        href={cardUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackCta("view_live_card", "card_live")}
        className="block text-center text-gray-500 hover:text-gray-300 text-xs py-1 transition-colors"
      >
        See my live card ↗
      </a>
    </div>
  );
}
