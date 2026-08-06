"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { PlanGate } from "@/components/PlanGate";

export type MyCard = {
  id: string;
  username: string;
  label: string | null;
  name: string | null;
};

/**
 * The dashboard's My Cards selector.
 *
 * DESKTOP (sm+) is unchanged from when this was inline in the page: every card
 * is a tile in a wrapping row, all visible at once.
 *
 * MOBILE collapses to just the SELECTED card plus a chevron on its right; the
 * rest drop down underneath when you tap it, and picking one collapses again.
 * Stacking every card full-width pushed the actual dashboard off-screen once
 * someone had three or four.
 *
 * ── The rules that keep this safe on every plan ──────────────────────────────
 *
 * 1. The chevron renders ONLY when there is more than one card. An account with
 *    a single card — which is every Free account — gets exactly the markup it
 *    had before: one row, no toggle, nothing to expand. That is the case that
 *    must not regress, so it is handled by absence rather than by a branch.
 *
 * 2. The "Ready for a second card? Go unlimited with Pro." tile is passed in as
 *    `upsell` and rendered OUTSIDE the collapsing set. It is never hidden by
 *    the dropdown, on any plan or viewport. It is also passed as a slot rather
 *    than rebuilt here, so its plan condition and markup stay in one place.
 *
 * 3. Rows keep their ORIGINAL index. `planInactive` (the LINK OFF — PRO ONLY
 *    badge on a downgraded account's extra cards) is positional — it marks
 *    cards past FREE_CARD_LIMIT — so the map runs over the full array and only
 *    VISIBILITY changes. Hiding a row never renumbers another.
 *
 * 4. Collapsing is CSS, not conditional rendering: hidden rows are still in the
 *    DOM with `hidden sm:flex`. That is what lets one markup tree serve both
 *    viewports, so desktop cannot drift from mobile.
 */
export default function MyCardsList({
  cards,
  activeUsername,
  isPro,
  freeCardLimit,
  view,
  sortBy,
  upsell,
}: {
  cards: MyCard[];
  activeUsername: string;
  isPro: boolean;
  freeCardLimit: number;
  view: string;
  sortBy: string;
  /** The Free-plan "second card" upsell, rendered untouched after the rows. */
  upsell?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  // One card = nothing to switch to. No chevron, no dropdown, no behaviour
  // change at all — see rule 1 above.
  const hasMultiple = cards.length > 1;

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select a card">
      {cards.map((card, cardIdx) => {
        const isActive = activeUsername === card.username;
        // Mirrors the public kill-switch (lib/card-active): on Free, only the
        // oldest freeCardLimit card(s) serve publicly.
        const planInactive = !isPro && cardIdx >= freeCardLimit;

        // The selected card is always visible and, on mobile, floats to the top
        // of the stack so the dropdown opens BENEATH it. sm:order-none puts the
        // desktop row back in its natural position.
        const visibility = isActive
          ? "flex order-first sm:order-none"
          : expanded
            ? "flex"
            : "hidden sm:flex";

        return (
          <div
            key={card.id}
            className={`items-center gap-3 rounded-xl px-4 py-3 transition-all border flex-1 min-w-full sm:min-w-[200px] ${visibility} ${
              isActive ? "bg-blue-600/10 border-blue-600/40" : "bg-gray-800/60 border-gray-700/60"
            }`}
          >
            <Link
              scroll={false}
              href={`?card=${card.username}&view=${view}&sort=${sortBy}`}
              role="radio"
              aria-checked={isActive}
              // Picking a different card collapses the dropdown. Without this
              // the panel would stay open over the card you just chose, because
              // a soft navigation keeps this component mounted.
              onClick={() => setExpanded(false)}
              className="flex items-center gap-3 flex-1 min-w-0"
            >
              <span
                className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
                  isActive ? "bg-blue-600 border-blue-600" : "border-gray-600"
                }`}
              >
                {isActive && (
                  <svg viewBox="0 0 20 20" fill="white" className="w-3 h-3">
                    <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" />
                  </svg>
                )}
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  isActive ? "bg-blue-600/30 border border-blue-500/40 text-blue-300" : "bg-gray-700 text-gray-400"
                }`}
              >
                {(card.label || card.name || card.username)[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">
                  {card.label || card.name || card.username}
                  {planInactive && (
                    <PlanGate
                      feature="link-off-badge"
                      nativeCopy="These links are only active on the Pro plan."
                      nativeContent={
                        <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/50 align-middle" title="These links are only active on the Pro plan.">
                          LINK OFF — PRO ONLY
                        </span>
                      }
                    >
                      <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/50 align-middle" title="This card's public link, QR and Swift Links are off on the Free plan — upgrade to Pro to reactivate them.">
                        LINK OFF — PRO ONLY
                      </span>
                    </PlanGate>
                  )}
                </p>
                <p className="text-gray-500 text-xs truncate">
                  /{card.username}
                  {card.name ? ` · ${card.name}` : ""}
                </p>
              </div>
            </Link>

            {/* Mobile-only switcher, on the right of the SELECTED card. Absent
                entirely when there is only one card. */}
            {isActive && hasMultiple && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-label={expanded ? "Hide your other cards" : "Show your other cards"}
                className="sm:hidden shrink-0 -mr-1.5 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  <path fillRule="evenodd" d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        );
      })}

      {/* Free-plan upsell — outside the collapsing set on purpose (rule 2). */}
      {upsell}
    </div>
  );
}
