"use client";

import { useEffect } from "react";
import { claimAdminTourAutoStart, startAdminTour } from "@/lib/tour";

// Runs the Office admin tour automatically the FIRST time someone opens the
// console. Until now the admin tour existed but was only reachable from the
// manual "Take a tour" button, so a new Office owner landed on the team page
// with no guidance at all.
//
// claimAdminTourAutoStart() is the guard: it returns true at most once per
// browser (and never once the tour has been completed), so skipping the tour
// doesn't make it reappear on every visit. The short delay lets the admin shell
// and the GuidedTour host mount so the first step has an anchor to attach to.
//
// Mounted only when an office actually EXISTS — while the owner is still on the
// "Name your team" form there is nothing to tour.
export default function AdminTourAutoStart() {
  useEffect(() => {
    if (!claimAdminTourAutoStart()) return;
    const t = setTimeout(() => startAdminTour(), 600);
    return () => clearTimeout(t);
  }, []);

  return null;
}
