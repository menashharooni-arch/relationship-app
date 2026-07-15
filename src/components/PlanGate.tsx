"use client";

import type { ReactNode } from "react";
import { useIsNativeApp } from "@/lib/platform";

/**
 * PlanGate — the single component every locked-feature surface renders through.
 *
 * WEB (isNativeApp === false, which is also what every server render and the
 * first client paint see): renders `children` verbatim. This is today's exact
 * behavior — the "Upgrade to Pro" CTAs, prices, and billing links that already
 * live at the call site. Byte-for-byte unchanged.
 *
 * NATIVE (isNativeApp === true, only inside the Capacitor iOS shell): renders a
 * neutral descriptive notice with the EXACT `nativeCopy` string — no button, no
 * link, no price, no "upgrade" verb, no mention of the website. A plain PRO /
 * OFFICE text badge is allowed (and is what {@link PlanBadge} / the notice use).
 *
 * Because `useIsNativeApp()` returns false on the server and on the first client
 * render, the web branch is what hydrates on both platforms; native only swaps
 * to the notice after mount. That keeps hydration consistent (see platform.ts).
 */

export type PlanTier = "pro" | "office";

export function PlanGate({
  feature,
  nativeCopy,
  tier = "pro",
  nativeContent,
  children,
}: {
  /** Stable key identifying the locked feature (for future analytics/debug). */
  feature: string;
  /** Exact neutral notice copy shown on native. Required. */
  nativeCopy: string;
  /** Badge label on native: "pro" → PRO, "office" → OFFICE. Defaults to pro. */
  tier?: PlanTier;
  /**
   * Optional native override. When provided, this is rendered on native instead
   * of the default neutral notice — used where the locked surface should stay
   * visually in place (e.g. a dimmed card whose "Upgrade · Pro" pill becomes a
   * plain <PlanBadge/>) rather than being replaced by a standalone notice.
   */
  nativeContent?: ReactNode;
  /** Today's exact web UI. Rendered unchanged on web. */
  children: ReactNode;
}) {
  const native = useIsNativeApp();

  if (!native) {
    // WEB PATH — unchanged, byte-for-byte.
    return <>{children}</>;
  }

  // NATIVE PATH.
  if (nativeContent !== undefined) return <>{nativeContent}</>;
  return <PlanNotice tier={tier} copy={nativeCopy} />;

  /*
   * ─────────────────────────────────────────────────────────────────────────
   * FUTURE EXTENSION POINT — US-only external-purchase link (region-aware).
   * ─────────────────────────────────────────────────────────────────────────
   * Apple's StoreKit External Purchase Link entitlement permits a SINGLE
   * region-gated link to an external web purchase flow, US storefront only.
   * When/if we adopt it, this is where it plugs in:
   *
   *   1. Thread a `region` signal into this component (a prop resolved from the
   *      server, or a native geolocation/StoreKit-storefront plugin lookup).
   *   2. Render an ADDITIONAL element BELOW <PlanNotice/> ONLY when region is
   *      "US" and the entitlement is active — nothing in any other region.
   *   3. That link's copy must stay within Apple's approved external-purchase
   *      wording; it does not reintroduce "upgrade"/pricing into the notice
   *      itself, which stays neutral for all users everywhere.
   *
   * Nothing renders here today. Do not implement behavior at this point without
   * the entitlement in place.
   */
}

/**
 * The neutral native notice. No link, no button, no price, no "upgrade" verb,
 * no website mention — just a PRO/OFFICE badge and the descriptive copy.
 * Exported so it can be unit-tested in isolation.
 */
export function PlanNotice({ tier = "pro", copy }: { tier?: PlanTier; copy: string }) {
  return (
    <div
      role="note"
      className="flex items-start gap-2.5 rounded-2xl border border-gray-800/80 bg-gray-900 px-4 py-3"
    >
      <PlanBadge tier={tier} />
      <p className="text-sm leading-snug text-gray-300">{copy}</p>
    </div>
  );
}

/**
 * A plain, non-interactive PRO / OFFICE text badge for locked buttons and
 * pills on native. Static text only — never a link.
 */
export function PlanBadge({ tier = "pro" }: { tier?: PlanTier }) {
  return (
    <span className="shrink-0 rounded-full bg-[#1D4ED8] px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-white">
      {tier === "office" ? "OFFICE" : "PRO"}
    </span>
  );
}
