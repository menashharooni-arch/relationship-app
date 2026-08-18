import { describe, it, expect } from "vitest";
import { layoutTiles, resolveTileSize, type SizedLink } from "@/lib/swiftlink-tiles";

const L = (size?: SizedLink["size"]): SizedLink => ({ label: "x", url: "https://x.com", size });

describe("tile size resolution", () => {
  it("free renders EVERYTHING compact — featured tiles and the grid are the advertised premium", () => {
    for (const size of [undefined, "featured", "grid", "compact"] as const) {
      expect(resolveTileSize(L(size), false)).toBe("compact");
    }
  });
  it("paid: explicit size wins, auto defaults to grid", () => {
    expect(resolveTileSize(L("featured"), true)).toBe("featured");
    expect(resolveTileSize(L("compact"), true)).toBe("compact");
    expect(resolveTileSize(L(), true)).toBe("grid");
  });
});

describe("layout preserves the pre-sizes page for all-auto links", () => {
  it("odd auto count: FIRST tile promoted to featured, rest paired", () => {
    const t = layoutTiles([L(), L(), L()], true).map((x) => x.size);
    expect(t).toEqual(["featured", "grid", "grid"]);
  });
  it("even auto count: all grid pairs, nothing promoted", () => {
    expect(layoutTiles([L(), L()], true).map((x) => x.size)).toEqual(["grid", "grid"]);
  });
});

describe("mixed sizes never leave a lone half-width tile", () => {
  it("explicit featured + odd autos: an auto is promoted, the explicit stays", () => {
    const t = layoutTiles([L("featured"), L(), L(), L()], true).map((x) => x.size);
    expect(t).toEqual(["featured", "featured", "grid", "grid"]);
  });
  it("compact rows don't count toward grid pairing", () => {
    const t = layoutTiles([L("compact"), L(), L("compact"), L()], true).map((x) => x.size);
    expect(t.filter((s) => s === "grid").length % 2).toBe(0);
  });
  it("all-explicit odd grids: the first explicit grid is promoted rather than none", () => {
    const t = layoutTiles([L("grid"), L("grid"), L("grid")], true).map((x) => x.size);
    expect(t).toEqual(["featured", "grid", "grid"]);
  });
  it("free layout is all-compact regardless of stored sizes", () => {
    const t = layoutTiles([L("featured"), L("grid"), L()], false).map((x) => x.size);
    expect(t).toEqual(["compact", "compact", "compact"]);
  });
});
