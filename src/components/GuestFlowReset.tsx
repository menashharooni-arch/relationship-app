"use client";

import { useEffect } from "react";
import { isAuthenticated } from "@/lib/guest-draft";
import { resetMarketingSketch } from "@/lib/guest-reset";

// Mounted on the marketing homepage. Landing on Home as a signed-out visitor
// drops the mini-builder sketch and any stashed plan pick, so the homepage
// builders reopen blank.
//
// It does NOT drop an unfinished card any more (owner rule 2026-09-16). Wiping
// it here made the header's "Get started free" open a blank card from the
// homepage but resume an old one from every other page. The builder now asks
// "Continue your card / Start a new card" instead, from every entry point —
// which also answers the "We kept your work from last time" surprise below.
//
// Why on mount and not only on a Home *click*: a visitor leaves a half-built
// card in far more ways than clicking our Home link — closing the tab, the
// browser Back button, typing a URL, following a link out. Wiring the reset to
// the click alone left a stale draft behind in every one of those cases, and the
// builder then greeted them with "We kept your work from last time" on a card
// they'd walked away from. Home is the entry point you come back through to
// start a new card, so clearing here covers every exit uniformly.
//
// A guest who is mid-build does NOT pass through here: the auth gate sends them
// straight to /login and back to /cards/new?claim=1, never via the homepage.
//
// Skipped entirely when a session cookie is present, so a signed-in user's
// pending draft (about to be claimed into their account) is never touched.
// Saved cards live in Postgres and are unreachable from here regardless.
export default function GuestFlowReset() {
  useEffect(() => {
    if (isAuthenticated()) return;
    // Back from a homepage builder's LinkedIn photo hop (/?builder=…): that is
    // the SAME visit continuing, not a fresh landing. The builder re-opens with
    // the sketch it stashed before the hop — wiping it here handed the visitor
    // their photo on a blank form (see readGuestLinkedInReturn).
    if (new URLSearchParams(window.location.search).has("builder")) return;
    resetMarketingSketch();
  }, []);

  return null;
}
