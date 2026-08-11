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
  hasCards,
}: {
  tier: TourTier;
  isOfficeMember: boolean;
  /**
   * Whether this account has any card yet. Without one the dashboard renders a
   * different tree with none of the tour's anchors in it, so the tour has to
   * drop every spotlighted step rather than hunt for elements that cannot
   * exist. isNative is NOT persisted — it is detected live, since the same
   * account uses both the app and the website.
   */
  hasCards: boolean;
}) {
  useEffect(() => {
    try {
      localStorage.setItem(TOUR_CTX_KEY, JSON.stringify({ tier, isOfficeMember, hasCards }));
    } catch {
      /* private mode — the tour just falls back to its base copy */
    }
  }, [tier, isOfficeMember, hasCards]);

  return null;
}
