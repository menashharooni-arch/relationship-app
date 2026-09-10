// ── Keeping the floating chat launcher off the buttons ───────────────────────
//
// The sales chat launcher is `position: fixed` in the bottom-right corner. The
// homepage hero's claim pill ends with "Start for free" in the bottom-right of
// its own row. On a short viewport those are the same place: measured on an
// iPhone 13 Mini (375x629 of visible page), the launcher covered 36.7% of that
// button, and a tap on the covered third opened support chat instead of
// starting a signup. On a 390x664 iPhone it was 9.1%. On 360, 393 and 430 it
// was nothing — which is why this survived: the collision depends on viewport
// HEIGHT, so it appears and disappears across devices with no pattern, and
// never on the desktop where the page is usually looked at.
//
// Nudging the launcher's offset cannot fix that. Whatever fixed inset you pick,
// some viewport height puts a CTA behind it. The only correct answer is for the
// launcher to know what it is sitting on, so this is a geometry check, not a
// guess: an element opts in with `data-chat-avoid`, and while the launcher
// overlaps one it yields.
//
// Pure and rect-only so it can be tested without a browser.

export const CHAT_AVOID_ATTR = "data-chat-avoid";

/** The part of a DOMRect this module needs. */
export type Box = { top: number; right: number; bottom: number; left: number };

/** Do two boxes share any area? Touching edges do not count. */
export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Should the launcher yield right now?
 *
 * `margin` grows the launcher's box before testing, so it also yields when it
 * is merely crowding a control rather than covering it — a launcher 2px from a
 * button still reads as being on top of it, and still eats the edge of the tap
 * target on a finger-sized pointer.
 *
 * A zero-area box is ignored: `display: none` reports 0x0 at the origin, and an
 * element that is not rendered cannot be covered.
 */
export function shouldYield(launcher: Box, zones: Box[], margin = 8): boolean {
  const grown: Box = {
    top: launcher.top - margin,
    right: launcher.right + margin,
    bottom: launcher.bottom + margin,
    left: launcher.left - margin,
  };
  return zones.some((z) => z.right > z.left && z.bottom > z.top && overlaps(grown, z));
}
