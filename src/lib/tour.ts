// ── Guided tour: shared state + control helpers ─────────────────────────────
// The tour spans three pages (Dashboard → Contacts → Settings). Because moving
// between them remounts everything, the "is a tour running / which step" state
// lives in sessionStorage so it survives navigation, and "have they seen it"
// lives in localStorage so the first-run banner only shows once.

import { TOUR_STEPS, resolveTourPath } from "./tour-steps";

// sessionStorage — per-tab, cleared when the tour ends.
export const TOUR_RUNNING = "sc_tour_running";
export const TOUR_INDEX = "sc_tour_index";
export const TOUR_CARD = "sc_tour_card"; // the card slug to keep selected across pages

// localStorage — persists so we don't nag a returning user.
export const TOUR_DONE = "sc_tour_completed";

// Events let an already-mounted tour host react instantly (no reload) when the
// tour is started or ended on the current page.
export const TOUR_START_EVENT = "sc:tour-start";
export const TOUR_END_EVENT = "sc:tour-end";

// The active card slug, so Dashboard/Contacts steps stay on the same card.
function currentCard(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = new URLSearchParams(window.location.search).get("card");
  if (fromUrl) return fromUrl;
  try {
    return localStorage.getItem("swiftcard_active_card");
  } catch {
    return null;
  }
}

// Begin the tour from step 0. If we're already on the first step's page, fire an
// event so the mounted host starts immediately; otherwise navigate there and let
// the host on that page resume from sessionStorage.
export function startTour(): void {
  if (typeof window === "undefined") return;
  const card = currentCard();
  try {
    sessionStorage.setItem(TOUR_RUNNING, "1");
    sessionStorage.setItem(TOUR_INDEX, "0");
    if (card) sessionStorage.setItem(TOUR_CARD, card);
    else sessionStorage.removeItem(TOUR_CARD);
  } catch { /* private mode — the event path below still works this session */ }

  const first = TOUR_STEPS[0];
  if (window.location.pathname === first.path) {
    window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
  } else {
    window.location.assign(resolveTourPath(first, card));
  }
}

// Clear all running state. `completed` marks it done so the banner won't return.
export function endTour(completed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(TOUR_RUNNING);
    sessionStorage.removeItem(TOUR_INDEX);
    sessionStorage.removeItem(TOUR_CARD);
    if (completed) localStorage.setItem(TOUR_DONE, "1");
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(TOUR_END_EVENT));
}

// Has the visitor already finished or skipped the tour before?
export function tourCompleted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return !!localStorage.getItem(TOUR_DONE);
  } catch {
    return false;
  }
}

// ── Office Admin guided tour: same mechanics, separate state ────────────────
// Its own storage keys so it can run, be skipped, or be replayed independently
// of the main dashboard tour — no shared "card" concept, since every step
// lives inside the Office admin console.
import { ADMIN_TOUR_STEPS } from "./admin-tour-steps";

export const ADMIN_TOUR_RUNNING = "sc_admin_tour_running";
export const ADMIN_TOUR_INDEX = "sc_admin_tour_index";
export const ADMIN_TOUR_DONE = "sc_admin_tour_completed";
export const ADMIN_TOUR_START_EVENT = "sc:admin-tour-start";
export const ADMIN_TOUR_END_EVENT = "sc:admin-tour-end";

export function startAdminTour(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ADMIN_TOUR_RUNNING, "1");
    sessionStorage.setItem(ADMIN_TOUR_INDEX, "0");
  } catch { /* private mode — the event path below still works this session */ }

  const first = ADMIN_TOUR_STEPS[0];
  if (window.location.pathname === first.path) {
    window.dispatchEvent(new CustomEvent(ADMIN_TOUR_START_EVENT));
  } else {
    window.location.assign(first.path);
  }
}

export function endAdminTour(completed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ADMIN_TOUR_RUNNING);
    sessionStorage.removeItem(ADMIN_TOUR_INDEX);
    if (completed) localStorage.setItem(ADMIN_TOUR_DONE, "1");
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(ADMIN_TOUR_END_EVENT));
}
