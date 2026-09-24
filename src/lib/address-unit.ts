// ── The unit line of an address ─────────────────────────────────────────────
//
// The address form has one "Unit # (optional)" box, and every surface used to
// print it as `Unit ${unit}`. People type what is on their door, so "Suite
// 1450" came out as "Unit Suite 1450" on the card, in the saved contact and in
// the editor preview (2026-09-24 UI review). A value that already says what it
// is keeps its own word; only a bare number or letter gets "Unit".
//
// One helper so the public card, the vCard, the address field and both editor
// previews can never disagree.

const DESIGNATOR = /^(#|no\.?\s|unit\b|suite\b|ste\.?\b|apt\.?\b|apartment\b|fl\.?\b|floor\b|flr\.?\b|rm\.?\b|room\b|bldg\.?\b|building\b|office\b|dept\.?\b|department\b|lot\b|space\b|spc\.?\b|trlr\b|pmb\b|box\b|po box\b|p\.o\.)/i;
/** "4th Floor", "12 Fl." — the designator comes last. */
const TRAILING_FLOOR = /\b(floor|fl|flr)\.?$/i;

export function unitLine(unit: string | null | undefined): string {
  const u = (unit ?? "").trim();
  if (!u) return "";
  return DESIGNATOR.test(u) || TRAILING_FLOOR.test(u) ? u : `Unit ${u}`;
}
