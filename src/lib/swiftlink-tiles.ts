// ── Swift Links tile layout ─────────────────────────────────────────────────
//
// hoo.be's pages breathe because tiles VARY — a full-width feature, pairs of
// half-width cards, slim rows for plain links. Ours rendered one shape. Each
// link can now carry a size, with an automatic default, and this module is the
// single place the layout decision lives (pure, so it's testable without
// rendering anything).
//
//   featured — full-width 1.91:1 image tile (the hero treatment)
//   grid     — half-width tile, packs in pairs (the classic album grid)
//   compact  — slim full-width row: icon circle + label + chevron. For plain
//              links that don't deserve a big image tile.
//
// AUTO (no explicit size): video → featured is wrong as a blanket rule (three
// videos would each eat a full row), so auto = grid, and the odd-grid-out is
// PROMOTED to featured — which reproduces the pre-sizes layout exactly for
// all-auto pages: odd count → first tile big, rest in pairs.
//
// PLAN LINE (the agreed Free floor): Free pages render every link COMPACT —
// featured tiles, the grid, and inline video are the "premium Swift Links"
// that plan-content has always advertised as Pro. Sizes a Free account has
// stored are kept, not deleted; they simply don't render until the plan does.

export type TileSize = "featured" | "grid" | "compact";

export type SizedLink = { label: string; url: string; emoji?: string; size?: TileSize };

/** What one link renders as, given the plan. */
export function resolveTileSize(link: SizedLink, paid: boolean): TileSize {
  if (!paid) return "compact";
  if (link.size === "featured" || link.size === "grid" || link.size === "compact") return link.size;
  return "grid";
}

/**
 * The final render plan: every link with its effective size, with the lone
 * odd grid tile (if any) promoted to featured so no half-width tile ever sits
 * alone next to empty space. Promotion picks the FIRST auto-sized grid tile —
 * the pre-sizes layout rule — and only falls back to the first EXPLICIT grid
 * tile when every grid tile was explicitly chosen.
 */
export function layoutTiles(links: SizedLink[], paid: boolean): { link: SizedLink; size: TileSize }[] {
  const out = links.map((link) => ({ link, size: resolveTileSize(link, paid) }));
  const grids = out.filter((t) => t.size === "grid");
  if (grids.length % 2 === 1) {
    const firstAuto = out.find((t) => t.size === "grid" && t.link.size === undefined);
    (firstAuto ?? grids[0]).size = "featured";
  }
  return out;
}
