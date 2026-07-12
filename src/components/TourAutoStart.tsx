"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { startTour, tourCompleted } from "@/lib/tour";

// Auto-starts the guided tour when the dashboard is opened with ?tour=1 (the
// onboarding /welcome flow appends it). Only fires for someone who hasn't taken
// the tour yet, and only once — startTour marks it via the TourBanner/localStorage
// flags. A short delay lets the dashboard + GuidedTour host finish mounting so
// the first step's anchor exists.
export default function TourAutoStart() {
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("tour") !== "1") return;
    if (tourCompleted()) return;
    const t = setTimeout(() => startTour(), 500);
    return () => clearTimeout(t);
  }, [params]);

  return null;
}
