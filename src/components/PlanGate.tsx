"use client";

import type { ReactNode } from "react";
import { useIsNativeApp } from "@/lib/platform";
import IapSubscribeButton from "@/components/NativePaywall";

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
 * no "upgrade" verb — followed by the In-App Purchase subscribe button
 * (NativePaywall). A plain PRO / OFFICE text badge is allowed (and is what
 * {@link PlanBadge} / the notice use).
 *
 * Purchase-path history, one rejection per posture: 1.0.0 (3) shipped this
 * notice inert (no button) — rejected under 3.1.1, paid content with no way to
 * buy it. 1.0.0 (7) added a link out to the default browser per the
 * US-storefront allowance in 3.1.1(a) — rejected anyway: App Review holds that
 * a subscription the app unlocks must be purchasable via IAP (3.1.3(b)). So
 * the button now opens a StoreKit paywall, and the link-out is gone.
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
   * A `nativeContent` override bypasses PlanNotice, so those call sites do NOT
   * get the subscribe button. That is intentional — they are inline pills and
   * badges with no room for one — but it means PlanNotice must stay the
   * primary gate surface. If the overrides ever become the common case, the
   * purchase path needs a second home (the billing panel already is one).
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
  // Owner decision 2026-08-27 (IAP live): NO gate string names the website any
  // more — Pro is sold in-app via the IAP button below, and account creation
  // happens in-app too, so "on swiftcard.me" anywhere in the shell is both
  // untrue and the steering signal a 3.1.1 reviewer flags. The strip below is
  // kept as a belt-and-braces guard in case the phrase ever creeps back into a
  // copy string.
  const iapCopy = copy.replace(new RegExp(`\\s*${SITE_PHRASE.replace(".", "\\.")}`, "g"), "");
  // "Pro feature — <what>" → the badge carries "Pro feature", the body gets
  // the what. Keeps the pinned copy string intact while the card reads as a
  // headline + reason instead of one long grey sentence.
  const body = iapCopy.replace(/^(Pro|Office) feature\s+—\s+/, "");
  return (
    <div
      role="note"
      className="relative overflow-hidden rounded-2xl p-[1.5px]"
      style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.9), rgba(139,92,246,0.7), rgba(37,99,235,0.5))" }}
    >
      <div className="relative rounded-[15px] bg-gray-900 px-4 py-4">
        <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-blue-600/20 blur-2xl" aria-hidden />
        <div className="relative flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <PlanBadge tier={tier} />
              <p className="text-sm font-bold text-white">{tier === "office" ? "Office feature" : "Pro feature"}</p>
            </div>
            <p className="mt-1 text-[13px] leading-snug text-gray-300 [text-wrap:pretty]">
              <GateCopy copy={body} />
            </p>
          </div>
        </div>
        {/* The purchase path, third iteration. 1.0.0 (3): inert notice —
            rejected (no way to buy). 1.0.0 (7): link out to the default browser
            per the US-storefront allowance — rejected anyway; App Review holds
            that content the app unlocks must be purchasable via IAP (3.1.3(b)).
            So: a real In-App Purchase paywall. Renders nothing on web, when
            signed out, or in a build without StoreKit products (see
            NativePaywall's fail-closed contract). */}
        {tier === "pro" && (
          <div className="mt-3 flex justify-end">
            <IapSubscribeButton />
          </div>
        )}
      </div>
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
