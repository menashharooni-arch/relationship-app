"use client";

import type { ReactNode } from "react";
import { useIsNativeApp } from "@/lib/platform";
import ExternalPurchaseButton from "@/components/ExternalPurchaseButton";

/**
 * PlanGate — the single component every locked-feature surface renders through.
 *
 * WEB (isNativeApp === false, which is also what every server render and the
 * first client paint see): renders `children` verbatim. This is today's exact
 * behavior — the "Upgrade to Pro" CTAs, prices, and billing links that already
 * live at the call site. Byte-for-byte unchanged.
 *
 * NATIVE (isNativeApp === true, only inside the Capacitor iOS shell): renders a
 * neutral descriptive notice with the EXACT `nativeCopy` string — no price and
 * no "upgrade" verb — followed by a subscribe button that opens the DEFAULT
 * BROWSER. A plain PRO / OFFICE text badge is allowed (and is what
 * {@link PlanBadge} / the notice use).
 *
 * That button is new in the resubmission after App Review rejected 1.0.0 (3)
 * under Guideline 3.1.1. The notice used to be entirely inert — no button, no
 * link — which was right under the pre-2025 rule and is precisely what got the
 * build rejected: the app unlocked paid content with no way to buy it. Apple's
 * own rejection named the remedy (link out to the default browser on the US
 * storefront), and 3.1.1(a) confirms it needs no entitlement there.
 *
 * ⚠️ THE APP MUST STAY US-STOREFRONT-ONLY while this is the purchase path. In
 * any other storefront a link out is a 3.1.1 violation rather than the fix, and
 * IAP would be required instead.
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
   * The external-purchase link this comment used to reserve space for is now
   * implemented, inside <PlanNotice/> below, as <ExternalPurchaseButton/>.
   *
   * Two things changed since it was written. Apple's US storefront no longer
   * requires the StoreKit External Purchase Link Entitlement at all —
   * guideline 3.1.1(a): "These entitlements are not required for developers to
   * include buttons, external links, or other calls to action in their United
   * States storefront apps." And the region signal it planned for is handled by
   * shipping the app to the US storefront only, which is a far harder guarantee
   * than anything resolvable at runtime.
   *
   * A `nativeContent` override bypasses PlanNotice, so those call sites do NOT
   * get the button. That is intentional — they are inline pills and badges with
   * no room for one — but it means PlanNotice must stay the primary gate
   * surface. If the overrides ever become the common case, the purchase path
   * needs a second home.
   */
}

/** The site phrase the gate copy ends on. Kept here so the one place that has
 *  to know how to set it is the one place that renders it. */
const SITE_PHRASE = "on swiftcard.me";

/**
 * Renders gate copy with "on swiftcard.me" held together on one line.
 *
 * Measured, not guessed: at every gate width (320–640px) the domain wrapped
 * onto a line BY ITSELF, leaving "on" stranded at the end of the line above. A
 * bare domain sitting alone on the last line reads as a stray link and pulls
 * exactly the wrong kind of attention to a notice whose whole job is to be
 * calm. Binding the two words means the phrase moves down together and still
 * reads as a sentence.
 *
 * A nowrap span, NOT a non-breaking space in the 30 copy strings: the strings
 * are asserted character-for-character across two test files, and typing a
 * U+00A0 into them would be invisible in review and impossible to grep.
 */
export function GateCopy({ copy }: { copy: string }) {
  const parts = copy.split(SITE_PHRASE);
  if (parts.length === 1) return <>{copy}</>;
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="whitespace-nowrap">{SITE_PHRASE}</span>}
          {part}
        </span>
      ))}
    </>
  );
}

/**
 * The neutral native notice. No link, no button, no price, no "upgrade" verb —
 * just a PRO/OFFICE badge and the descriptive copy.
 *
 * The copy now NAMES the website (owner decision, 2026-08-12) so a Free user
 * who hits a locked feature in the app learns where the plan lives. It stays
 * inert text: no anchor, no href, no tap target. That distinction is the whole
 * compliance posture here and is pinned by plan-gate.test.ts.
 *
 * Exported so it can be unit-tested in isolation.
 */
export function PlanNotice({ tier = "pro", copy }: { tier?: PlanTier; copy: string }) {
  return (
    <div
      role="note"
      className="rounded-2xl border border-gray-800/80 bg-gray-900 px-4 py-3"
    >
      <div className="flex items-start gap-2.5">
        <PlanBadge tier={tier} />
        {/* text-wrap:pretty pulls a word down rather than leaving a stubby last
            line — the copy grew by "on swiftcard.me" and several of these now
            break onto a short final line. Same pattern the card page's bio uses.
            Unsupported engines simply ignore it. */}
        <p className="text-sm leading-snug text-gray-300 [text-wrap:pretty]">
          <GateCopy copy={copy} />
        </p>
      </div>
      {/* The purchase path. Until 1.0.0 (3) this notice was deliberately inert —
          no button, no link — which was the correct posture under the old rule
          and is what App Review rejected: the app unlocked paid content with no
          way to buy it. On the US storefront Apple permits a link out to the
          default browser instead of IAP, so the notice now ends in one.
          Renders nothing on web, and nothing in a build without the native
          plugin (see ExternalPurchaseButton). */}
      <ExternalPurchaseButton className="mt-3" />
    </div>
  );
}

/**
 * A plain, non-interactive PRO / OFFICE text badge for locked buttons and
 * pills on native. Static text only — never a link.
 */
export function PlanBadge({ tier = "pro" }: { tier?: PlanTier }) {
  return (
    // #3B82F6, not the brand's #1D4ED8: the deep brand blue read as heavy on a
    // 9px pill sitting against gray-900, which is the only place this badge
    // ever appears (it is native-only — every call site is a PlanGate
    // nativeContent slot or PlanNotice). Changing it here changes it at every
    // gate point at once and cannot touch web, which never renders this.
    //
    // Contrast note: white on #3B82F6 measures 3.7:1, under the 4.5:1 AA floor
    // that 9px bold text needs (#1D4ED8 was 6.6:1). Accepted deliberately —
    // the badge repeats what the sentence beside it already says in full, so it
    // carries no information on its own. #2563EB is the nearest shade that
    // clears AA at 5.1:1 if this should ever become load-bearing.
    <span className="shrink-0 rounded-full bg-[#3B82F6] px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-white">
      {tier === "office" ? "OFFICE" : "PRO"}
    </span>
  );
}
