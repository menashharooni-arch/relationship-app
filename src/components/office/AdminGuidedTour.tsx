"use client";

// Thin wrapper around the shared tour engine, pointed at the Office admin
// step list and its own storage keys — runs independently of the main
// dashboard tour. Mounted once in the /office/admin layout.

import { useRouter } from "next/navigation";
import GuidedTour from "@/components/GuidedTour";
import { ADMIN_TOUR_STEPS } from "@/lib/admin-tour-steps";
import { ADMIN_TOUR_RUNNING, ADMIN_TOUR_INDEX, ADMIN_TOUR_START_EVENT, endAdminTour } from "@/lib/tour";

export default function AdminGuidedTour() {
  const router = useRouter();
  return (
    <GuidedTour
      steps={ADMIN_TOUR_STEPS}
      runningKey={ADMIN_TOUR_RUNNING}
      indexKey={ADMIN_TOUR_INDEX}
      startEvent={ADMIN_TOUR_START_EVENT}
      onFinish={(completed) => {
        endAdminTour(completed);
        router.push("/office/admin");
      }}
    />
  );
}
