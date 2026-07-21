"use client";

import { useEffect } from "react";
import { isAuthenticated } from "@/lib/guest-draft";
import { resetGuestFlow } from "@/lib/guest-reset";

// Mounted on the marketing homepage. Landing on Home as a signed-out visitor
// means whatever card/preview they were building earlier was abandoned — so the
// unfinished guest draft, the mini-builder sketch, and any stashed plan pick are
// all dropped here.
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
    resetGuestFlow();
  }, []);

  return null;
}
