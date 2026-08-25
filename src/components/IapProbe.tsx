"use client";

import { useEffect } from "react";
import { canOfferIap, getIapPackages } from "@/lib/iap";
import { detectNativeApp } from "@/lib/platform";

/**
 * IAP preflight probe — renders nothing, ever. Mounted by the dashboard ONLY
 * for the dedicated test account (iap-test@swiftcard.me), so the general
 * population never runs it.
 *
 * Why it exists: the purchase chain can only be truthfully verified from
 * inside the shell (StoreKit product fetch = Paid Apps agreement active + ASC
 * products fetchable + RevenueCat offering configured), but the simulator
 * offers no reliable headless way to tap the paywall open. This runs the same
 * calls the paywall makes and reports the outcome to the console (visible in
 * the simulator's log stream) and to /api/client-error (visible in server
 * logs), so the result can be read without touching the UI.
 */
export default function IapProbe() {
  useEffect(() => {
    if (!detectNativeApp()) return;
    (async () => {
      const report = { probe: "iap-preflight", offerable: false, packages: [] as unknown[] };
      try {
        report.offerable = await canOfferIap();
        if (report.offerable) {
          report.packages = (await getIapPackages()).map((p) => ({
            id: p.productId, period: p.period, price: p.priceString, intro: p.introPriceString,
          }));
        }
      } catch (e) {
        (report as Record<string, unknown>).error = e instanceof Error ? e.message : String(e);
      }
      const line = `[iap-probe] ${JSON.stringify(report)}`;
      console.log(line);
      fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: line.slice(0, 480), level: "error" }),
      }).catch(() => {});
    })();
  }, []);
  return null;
}
