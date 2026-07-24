"use client";

import { useEffect } from "react";
import { TOUR_CTX_KEY } from "@/lib/tour";
import type { TourTier } from "@/lib/tour-steps";

// Persists the account's plan/role so the globally-mounted guided tour (which
// has no server data of its own) can describe the RIGHT plan. Rendered on the
// dashboard — the tour's first page and where every replay starts — so the
// value is fresh before the tour boots. Value survives navigation + revisits.
export default function TourContextPersist({
  tier,
  isOfficeMember,
}: {
  tier: TourTier;
  isOfficeMember: boolean;
}) {
  useEffect(() => {
    try {
      localStorage.setItem(TOUR_CTX_KEY, JSON.stringify({ tier, isOfficeMember }));
    } catch {
      /* private mode — the tour just falls back to its base copy */
    }
  }, [tier, isOfficeMember]);

  return null;
}
