import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SWIFTLINK_LOOKS, fallbackTile, isLightSurface } from "@/lib/swiftlink-looks";

// ── The tile a link falls back to when it has no picture ─────────────────────
//
// This used to be one of four hard-coded rainbow gradients chosen by index, so
// a page could show a purple, a blue, a red and a green tile under a headshot
// no matter which Look its owner picked. It is now derived from the Look, and
// the thing that has to hold for EVERY Look is that the label still reads.
//
// The label does not sit on the raw tile: the bottom 70% of every tile carries
// a scrim, dark under white text and light under dark text, and the label sits
// at the very bottom of that ramp. So the surface to test is the tile composited
// with the scrim at the label's position — which is what fails if a Look ever
// lands in the middle, light enough to wash out white and dark enough to
// swallow black.

const hex = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = (rgb: number[]) =>
  rgb
    .map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    })
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: number[], b: number[]) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
/** `over` at `alpha` on top of `under`. */
const over = (o: number[], u: number[], a: number) => o.map((c, i) => c * a + u[i] * (1 - a));

/** The three gradient stops the function emits. */
function stops(bg: string): string[] {
  return bg.match(/#[0-9a-fA-F]{6}/g) ?? [];
}

// How strong the scrim is where the label sits.
//
// This is a BOUND, not a measurement. The real figure depends on the rendered
// tile height, and modelling it here got it wrong once already: the first
// version assumed 0.68 when the label actually lands nearer 0.44 of the ramp,
// so this test was checking a surface that does not exist. It erred toward
// "more scrim than there really is", which is the optimistic direction — a
// tile could have passed here and still been unreadable.
//
// So this stays a cheap smoke check with a deliberately WEAK scrim, and the
// real answer comes from tests/render/swiftlink-tile-contrast.test.ts, which
// hides the label, screenshots the pixel underneath it and measures that.
// Keep the two in that order: this one fails fast, that one is the truth.
const SCRIM_AT_LABEL = 0.4;

describe("every Look produces a readable tile", () => {
  const cases = SWIFTLINK_LOOKS.flatMap((look) => [0, 1, 2, 3].map((i) => ({ look, i })));

  it.each(cases)("$look.id tile $i keeps its label legible", ({ look, i }) => {
    const fb = fallbackTile(look, i);
    const parts = stops(fb.background);
    expect(parts).toHaveLength(3);

    // The label's ink, and the scrim that is painted under it — both follow
    // fb.light, exactly as the renderer does.
    const ink = hex(fb.light ? "#0F172A" : "#FFFFFF");
    const scrim = hex(fb.light ? "#FFFFFF" : "#000000");
    const scrimAlpha = fb.light ? 0.82 * (SCRIM_AT_LABEL / 0.75) : SCRIM_AT_LABEL;

    // Worst case is whichever gradient stop sits under the label — check all.
    for (const stop of parts) {
      const surface = over(scrim, hex(stop), Math.min(scrimAlpha, 0.92));
      const c = contrast(ink, surface);
      expect({ look: look.id, i, stop, contrast: +c.toFixed(2) }).toMatchObject({
        contrast: expect.any(Number),
      });
      expect(c).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("stays inside the Look's palette instead of inventing colour", () => {
    // The point of the change: a tile must be a blend of the page's own two
    // colours, never a hue that appears nowhere on the page.
    for (const look of SWIFTLINK_LOOKS) {
      for (let i = 0; i < 4; i++) {
        const mid = hex(stops(fallbackTile(look, i).background)[1]);
        const a = hex(look.accent);
        const t = hex(look.tile);
        // Each channel of the middle stop lies between the accent and the tile.
        for (let c = 0; c < 3; c++) {
          const lo = Math.min(a[c], t[c]) - 1;
          const hi = Math.max(a[c], t[c]) + 1;
          expect({ look: look.id, i, c, v: mid[c], lo, hi }).toMatchObject({ v: expect.any(Number) });
          expect(mid[c]).toBeGreaterThanOrEqual(lo);
          expect(mid[c]).toBeLessThanOrEqual(hi);
        }
      }
    }
  });

  it("the four tiles of one page are visibly different from each other", () => {
    for (const look of SWIFTLINK_LOOKS) {
      const mids = [0, 1, 2, 3].map((i) => stops(fallbackTile(look, i).background)[1]);
      expect(new Set(mids).size).toBe(4);
    }
  });

  it("index wraps, and negatives do not crash", () => {
    const look = SWIFTLINK_LOOKS[0];
    expect(fallbackTile(look, 4).background).toBe(fallbackTile(look, 0).background);
    expect(fallbackTile(look, -1).background).toBe(fallbackTile(look, 3).background);
  });

  it("isLightSurface agrees with what the eye calls light", () => {
    expect(isLightSurface("#FFFFFF")).toBe(true);
    expect(isLightSurface("#000000")).toBe(false);
    expect(isLightSurface("#F5F5F5")).toBe(true);
    expect(isLightSurface("#1D4ED8")).toBe(false);
  });
});

describe("the rainbow is gone from both the product and its mirror", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const RAINBOW = "#4338ca 0%, #7c3aed 55%, #db2777 100%";

  it.each([
    ["src/components/SwiftLinkButtons.tsx", "the live Swift Links page"],
    ["src/components/site/HeroShowcase.tsx", "the marketing hero that mirrors it"],
  ])("%s no longer hard-codes it (%s)", (file) => {
    const src = read(file);
    expect(src).not.toContain(RAINBOW);
    expect(src).not.toContain("FALLBACK_GRADIENTS");
    expect(src).toContain("fallbackTile");
  });

  // The giant centred emoji was the cartoon look; whatever the owner picked
  // now rides in the same small corner chip the picture tiles use.
  it("no tile centres a 4xl emoji any more", () => {
    expect(read("src/components/SwiftLinkButtons.tsx")).not.toContain('text-4xl drop-shadow');
    expect(read("src/components/site/HeroShowcase.tsx")).not.toContain('text-4xl drop-shadow');
  });

  it("the hero's demo pages carry no emoji at all", () => {
    const src = read("src/components/site/HeroShowcase.tsx");
    const grids = src.match(/grid: \[[^\]]*\]/g) ?? [];
    expect(grids.length).toBeGreaterThanOrEqual(6);
    // Any astral-plane character in a grid literal is an emoji.
    for (const g of grids) expect(g).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
