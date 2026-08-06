// "Did anything the card actually SHOWS change?"
//
// Two cached artifacts are snapshots of the card — the share-preview PNG that
// iMessage/WhatsApp render for a card link, and the Swift Signature PNG that
// automated emails sign off with. Both must be invalidated when the card
// changes, and the owner must be nudged to re-copy their signature.
//
// The trap is the inverse: doing that when NOTHING changed. Opening the editor
// and pressing Save, or an office admin reviewing an employee's card and
// saving it untouched, would otherwise delete both PNGs and drop a "your card
// changed" notification about an edit that never happened.
//
// Two routes need this rule — the owner's own save (api/cards/[id]) and an
// office admin's save (api/office/cards/[id]) — so it lives here. A second copy
// is how they drift apart, and the drift is invisible: the wrong answer is a
// notification, not an error.

/** Fields rendered ON the card. `label` is an internal name and is NOT one. */
export const ON_CARD_SCALARS = [
  "name", "title", "company", "phone", "email", "website",
  "linkedin", "instagram", "twitter", "tiktok", "template", "logo_url",
] as const;

/**
 * Stable, key-order-independent JSON. Postgres jsonb does not preserve key
 * order, so a re-saved-but-identical customization blob comes back reordered
 * and a naive JSON.stringify comparison reports a design change every time.
 */
export function canonicalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === "object") {
    return Object.keys(v as Record<string, unknown>).sort().reduce<Record<string, unknown>>((o, k) => {
      o[k] = canonicalize((v as Record<string, unknown>)[k]);
      return o;
    }, {});
  }
  return v;
}

/**
 * True only when a submitted field holds a value DIFFERENT from the stored one.
 *
 * `before` must be a row selected before the write, and it must include every
 * column in `scalars` — a column missing from the select reads as undefined and
 * makes any non-empty submitted value look like a change, which is the exact
 * false positive this exists to prevent.
 */
export function cardContentChanged(
  before: Record<string, unknown>,
  updates: Record<string, unknown>,
  scalars: readonly string[] = ON_CARD_SCALARS,
): boolean {
  for (const k of scalars) {
    // `k in updates` matters: a field the form didn't submit is not a change,
    // even if the stored value is non-empty.
    if (k in updates && String(updates[k] ?? "") !== String(before[k] ?? "")) return true;
  }
  if ("customization" in updates) {
    return (
      JSON.stringify(canonicalize(updates.customization ?? {})) !==
      JSON.stringify(canonicalize(before.customization ?? {}))
    );
  }
  return false;
}
