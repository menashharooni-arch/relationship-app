"use client";

import { useSearchParams } from "next/navigation";
import PortalSkeleton from "@/components/PortalSkeleton";
import PickerSkeleton from "@/components/PickerSkeleton";

// /dashboard renders two very different screens: the card PICKER when no
// ?card is selected (app launch, post-login) and the card's DASHBOARD when
// one is. loading.tsx gets no request data, but the URL is already updated
// when it renders — so branch the skeleton on the same signal the page
// itself uses. Client navigations resolve the hook immediately; the initial
// document load shows the Suspense fallback in loading.tsx instead (the
// picker variant — launches land on /dashboard with no card, so that IS the
// initial-load case).
export default function DashboardLoadingSwitch() {
  const card = useSearchParams().get("card");
  return card ? <PortalSkeleton /> : <PickerSkeleton />;
}
