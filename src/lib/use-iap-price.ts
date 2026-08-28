"use client";

import { useEffect, useState } from "react";

/**
 * The LIVE StoreKit price string for the monthly Pro product ("$4.99"), or
 * null until it is known (and forever on web, where there is no StoreKit).
 *
 * Every price the app shows must come from here rather than PLAN_PRICES: the
 * App Store price is the authority, and a hardcoded number would drift the
 * moment a price changes or a storefront differs (3.1.2).
 */
export function useIapMonthlyPrice(): string | null {
  const [price, setPrice] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getIapPackages } = await import("@/lib/iap");
        const pkgs = await getIapPackages();
        const monthly = pkgs.find((p) => p.period === "monthly");
        if (!cancelled && monthly) setPrice(monthly.priceString);
      } catch { /* no StoreKit — the caller renders no price */ }
    })();
    return () => { cancelled = true; };
  }, []);
  return price;
}
