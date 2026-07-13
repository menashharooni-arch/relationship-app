"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { startTour, tourCompleted } from "@/lib/tour";

// Auto-starts the guided tour when the dashboard is opened with ?tour=1 (the
// onboarding /welcome flow appends it). Only fires for someone who hasn't taken
// the tour yet, and only once — startTour marks it via the TourBanner/localStorage
// flags.
//
// For a brand-new account the AppStorePopup ("Continue on the web" / "Download
// on the App Store") shows first. The tour must NOT start underneath it — it
// waits for that popup to be dismissed (the "sc:appstore-done" event) and only
// then starts. When no popup is pending (already seen, or not a welcome load) it
// starts after a short delay so the dashboard + GuidedTour host have mounted.
export default function TourAutoStart() {
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("tour") !== "1") return;
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
