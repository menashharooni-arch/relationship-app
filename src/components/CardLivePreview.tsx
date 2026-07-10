"use client";

// In-app "see your card live" preview. Renders a button that opens the REAL
// public card (via ?embed=1) inside a phone frame in a full-screen modal — the
// exact thing recipients see, not a mockup. Used in the dashboard's Your Card
// panel and made deliberately clickable during the guided tour's interactive
// "your-card" step (the tour stops intercepting clicks so this really opens).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function CardLivePreview({
  cardUrl,
  className = "",
}: {
  /** Full public URL of the card, e.g. https://swiftcard.me/card/alexmorgan */
  cardUrl: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal only mounts client-side
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  // The embeddable, chrome-free card view. Same origin, so it's genuinely the
  // live card — tap-to-save and share buttons all work.
  const src = `${cardUrl.replace(/\/$/, "")}?embed=1`;

  return (
    <>
      <button
        type="button"
        data-tour-preview
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-full py-2.5 transition-colors ${className}`}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden>
          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
        </svg>
        See your card live
      </button>

      {mounted && open && createPortal(
        // z sits above the guided-tour overlay (z-[10000]) so it opens cleanly
        // even mid-tour.
        <div
          className="fixed inset-0 z-[10050] bg-gray-950/95 backdrop-blur flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Your live card preview"
        >
          <div className="shrink-0 h-16 px-6 flex items-center justify-between">
            <p className="text-white font-semibold text-sm">Your live card</p>
            <div className="flex items-center gap-5">
              <a href={cardUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 font-medium hidden sm:inline">
                Open in new tab ↗
              </a>
              <button onClick={() => setOpen(false)} aria-label="Close preview" className="text-gray-400 hover:text-white transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto flex items-start sm:items-center justify-center p-4 sm:p-8">
            <div
              className="rounded-[2.4rem] p-2.5 shrink-0"
              style={{ width: 384, maxWidth: "100%", background: "#0f172a", border: "2px solid #1e293b", boxShadow: "0 40px 90px -30px rgba(0,0,0,0.7)" }}
            >
              <div className="relative overflow-hidden bg-white" style={{ borderRadius: "1.9rem", height: "min(720px, 74vh)" }}>
                <iframe src={src} title="Your live SwiftCard" className="w-full h-full" style={{ border: 0 }} />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
