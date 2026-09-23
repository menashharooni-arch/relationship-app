"use client";

// Prominent first-run banner at the top of the dashboard: a big "Take a Tour"
// invitation with a one-line "here's how to navigate your app" subtitle and a
// Skip.
//
// Shows ONLY on a first-card / new-account load (?tour=1 or ?welcome=1 — the
// same params the wizard and onboarding redirect with), and only until the
// tour has been taken or skipped. It used to gate on localStorage alone, so
// every sign-in from a fresh browser or computer greeted a YEARS-old account
// with "New here?" (owner bug report 2026-09-02: the tour invite belongs to
// the moment the first card is created, not to every login).

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { startTour, tourCompleted, TOUR_END_EVENT, TOUR_RUNNING, TOUR_START_EVENT } from "@/lib/tour";
import { afterAiConsent } from "@/lib/ai-consent-sequence";
import { detectNativeApp } from "@/lib/platform";
import { appStoreReady } from "@/lib/app-store";

export default function TourBanner() {
  const [show, setShow] = useState(false);
  const params = useSearchParams();

  useEffect(() => {
    const firstRun = params.get("tour") === "1" || params.get("welcome") === "1";
    // Delayed: on these loads TourAutoStart opens the tour ~0.5s later, and a
    // banner that appears only to vanish is a flash. It shows only if the
    // tour did NOT start (the start event below cancels it).
    // In the app the 1.5s only starts once the AI permission sheet is answered
    // (lib/ai-consent-sequence): the tour waits for it, and without waiting too
    // this invite would pop up behind the sheet, then vanish when the tour
    // starts. Immediate on the web.
    // Armed at the same 500ms point as TourAutoStart in the app: by then the
    // root layout has reset the phase to "pending" for this screen, so a
    // "settled" left over from an earlier screen cannot release it early.
    let pending: ReturnType<typeof setTimeout> | null = null;
    let armT: ReturnType<typeof setTimeout> | null = null;
    let cancelWait = () => {};
    // Re-checked when the timer fires: in the app this arms at the same 500ms
    // point as TourAutoStart, which registers first — so the tour's start event
    // arrived BEFORE `pending` existed, cancelled nothing, and the invite then
    // appeared behind the running tour, pushing the dashboard down under it.
    const tourRunning = () => { try { return sessionStorage.getItem(TOUR_RUNNING) === "1"; } catch { return false; } };
    const arm = () => { cancelWait = afterAiConsent(() => { pending = setTimeout(() => { if (!tourRunning()) setShow(true); }, 1500); }); };
    // On the web a new account's welcome load can open the "Your account is
    // ready" App Store popup first. TourAutoStart waits for it to close; this
    // didn't, so the invite appeared behind the popup and vanished again when
    // the tour started. Same test TourAutoStart uses.
    let popupPending = false;
    try {
      popupPending = !detectNativeApp() && appStoreReady() && params.get("welcome") === "1" && localStorage.getItem("sc_appstore_seen") !== "1";
    } catch { /* storage blocked — treat as no popup */ }
    if (firstRun && !tourCompleted()) {
      if (detectNativeApp()) armT = setTimeout(arm, 500);
      else if (popupPending) window.addEventListener("sc:appstore-done", arm, { once: true });
      else arm();
    }
    // If the tour finishes/skips elsewhere, hide the banner too.
    // …and the moment it STARTS: a new account's tour auto-starts, and a
    // "Take a quick tour" invite sitting under the running tour is noise.
    const onEnd = () => { if (pending) { clearTimeout(pending); pending = null; } setShow(false); };
    window.addEventListener(TOUR_END_EVENT, onEnd);
    window.addEventListener(TOUR_START_EVENT, onEnd);
    return () => {
      if (armT) clearTimeout(armT);
      window.removeEventListener("sc:appstore-done", arm);
      cancelWait();
      if (pending) clearTimeout(pending);
      window.removeEventListener(TOUR_END_EVENT, onEnd);
      window.removeEventListener(TOUR_START_EVENT, onEnd);
    };
  }, [params]);

  if (!show) return null;

  function skip() {
    setShow(false);
    try { localStorage.setItem("sc_tour_completed", "1"); } catch { /* ignore */ }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl mb-5 p-[1.5px] bg-gradient-to-r from-blue-600 via-violet-500 to-blue-500">
      <div className="rounded-[calc(1rem-1.5px)] bg-gray-950 px-5 py-4 sm:py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={1.8} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m0 0a6 6 0 016 6c0 2-1 3-2 4s-1.5 2-1.5 3h-5c0-1-.5-2-1.5-3s-2-2-2-4a6 6 0 016-6z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-white font-extrabold text-lg sm:text-xl leading-tight">Take a quick tour</p>
              <p className="text-gray-400 text-[0.8125rem] mt-0.5 leading-snug">New here? See how to navigate your dashboard and every feature in about a minute.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={skip}
              className="text-sm font-semibold text-gray-400 hover:text-white px-3 py-2.5 rounded-full transition-colors"
            >
              Skip
            </button>
            <button
              onClick={startTour}
              className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-full transition-colors shadow-lg shadow-blue-900/40"
            >
              Take a Tour →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
