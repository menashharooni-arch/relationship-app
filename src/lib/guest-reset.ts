"use client";

// ── Abandoning a guest flow ──────────────────────────────────────────────────
// A signed-out visitor's unfinished work lives entirely in localStorage, spread
// across three keys that are written by different parts of the funnel:
//
//   swiftcard_guest_draft  — the full card wizard draft (text, links, address,
//                            colors/template, and the logo/headshot as data URLs)
//   swiftcard_prefill      — the marketing mini-builder "sketch" (card /
//                            SwiftLink / signature previews on the homepage)
//   swiftcard_plan_intent  — the Free/Pro/Office pick made before signup
//
// Leaving for Home means "I'm not finishing this" — so all three go, and every
// one of those flows reopens completely blank instead of resurrecting what was
// half-entered on an earlier visit.
//
// This ONLY touches this browser's localStorage. Saved cards live in Postgres
// and are never reachable from here, so a signed-in user's real cards (and any
// draft already claimed into their account) cannot be affected.

import { clearDraft } from "./guest-draft";
import { clearPrefill } from "./prefill";
import { clearPlanIntent } from "./plan-intent";

export function resetGuestFlow(): void {
  clearDraft();
  clearPrefill();
  clearPlanIntent();
}
