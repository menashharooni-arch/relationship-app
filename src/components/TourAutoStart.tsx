"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { startTour, tourCompleted } from "@/lib/tour";

// Auto-starts the guided tour on the first dashboard load of a new account.
//
// Triggers on ?tour=1 OR ?welcome=1. Requiring tour=1 alone is what broke this:
// it made every redirect responsible for remembering a second flag, and two of
// them didn't. A brand-new free account landed on /dashboard?welcome=1 from
// onboarding, and a brand-new paid account on /dashboard?upgraded=true&welcome=1
// from checkout — both marked as new, neither starting the tour. It was missing
// on EVERY plan, and only the guest-card path (which routes via /welcome) worked.
//
// welcome=1 already means "this account was just created", so treating it as the
// trigger removes the duplicate flag rather than adding a third place to forget.
// tour=1 is still honoured on its own for the "Take a tour" entry points, which
// replay it deliberately for an existing user.
//
// Only fires for someone who hasn't taken the tour yet, and only once —
// startTour marks it via the TourBanner/localStorage flags.
//
// For a brand-new account the AppStorePopup ("Continue on the web" / "Download
// on the App Store") shows first. The tour must NOT start underneath it — it
// waits for that popup to be dismissed (the "sc:appstore-done" event) and only
// then starts. When no popup is pending (already seen, or not a welcome load) it
// starts after a short delay so the dashboard + GuidedTour host have mounted.
export default function TourAutoStart() {
  const params = useSearchParams();

  useEffect(() => {
    const requested = params.get("tour") === "1" || params.get("welcome") === "1";
    if (!requested) return;
    if (tourCompleted()) return;

    // Will the app-store popup show first? It appears on a welcome load until
    // it's been seen once (its own localStorage guard).
    let popupPending = false;
    try {
      popupPending = params.get("welcome") === "1" && localStorage.getItem("sc_appstore_seen") !== "1";
    } catch { /* storage blocked — treat as no popup */ }

    if (!popupPending) {
      const t = setTimeout(() => startTour(), 500);
      return () => clearTimeout(t);
    }

    // Start the tour once the app-store screen is dismissed.
    const onDone = () => setTimeout(() => startTour(), 350);
    window.addEventListener("sc:appstore-done", onDone, { once: true });
    return () => window.removeEventListener("sc:appstore-done", onDone);
  }, [params]);

  return null;
}
