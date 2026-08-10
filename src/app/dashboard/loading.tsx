import { Suspense } from "react";
import PickerSkeleton from "@/components/PickerSkeleton";
import DashboardLoadingSwitch from "./DashboardLoadingSwitch";

// Shown instantly on navigation to /dashboard while the server renders.
// Picker-shaped when no card is selected (launch), dashboard-shaped when one
// is — see DashboardLoadingSwitch. The Suspense fallback covers the initial
// document load (useSearchParams can't resolve server-side): launches arrive
// at /dashboard with no card, so the picker variant is the right guess there.
export default function Loading() {
  return (
    <Suspense fallback={<PickerSkeleton />}>
      <DashboardLoadingSwitch />
    </Suspense>
  );
}
