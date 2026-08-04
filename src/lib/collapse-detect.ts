// ── Detecting "rendered, but invisible" ──────────────────────────────────────
//
// CardScaler measures its slot and scales its content to fit. If the slot is
// zero-wide it computes scale 0 and renders at opacity 0 — correct arithmetic,
// invisible result, no error anywhere. That is precisely how the homepage
// SwiftLink live preview shipped broken for ~12 days (Aug 2026): the server
// HTML was right, the React state was right, every test and uptime check was
// green, and only a human eye caught it.
//
// So the component reports itself. This predicate decides when a zero
// measurement is a DEFECT rather than a legitimate state, and is kept pure and
// separate so the distinction is unit-testable — getting it wrong in the noisy
// direction would poison the production error log, which has burned us before.

type Measurable = {
  clientWidth: number;
  /** null when the element (or an ancestor) is display:none. */
  offsetParent: unknown;
  isConnected?: boolean;
};

/**
 * True only when an element that IS on the page has collapsed to no width.
 *
 * Deliberately false for the legitimate zero-width cases, all of which are
 * normal in this app:
 *  - display:none subtrees — the mobile plan tabs hide two of three plan cards,
 *    and a closed mini-builder modal keeps its preview mounted but hidden.
 *    Those measure 0 correctly, and offsetParent is null for all of them.
 *  - detached nodes mid-unmount.
 */
export function isCollapsedWhileVisible(el: Measurable | null | undefined): boolean {
  if (!el) return false;
  if (el.isConnected === false) return false;
  if (el.offsetParent === null) return false; // hidden on purpose
  return el.clientWidth < 1;
}
