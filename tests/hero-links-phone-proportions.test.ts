import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// The homepage hero's Swift Links phone must have the same proportions as the
// centre phone. Owner, 2026-09-24: it was "awkwardly long and skinny", so its
// screen was cut to 441px (28b55b18). Two hours later an unrelated commit
// carried a stale copy of HeroShowcase and put the long phone back, and it
// stayed live until the owner noticed again (2026-09-25). This pins the shape.

const src = readFileSync("src/components/site/HeroShowcase.tsx", "utf8");

function phone(widthExpr: string) {
  const at = src.indexOf(`width={${widthExpr}}`);
  expect(at, `a PhoneFrame with width={${widthExpr}}`).toBeGreaterThan(-1);
  const block = src.slice(at, src.indexOf("</PhoneFrame>", at));
  const h = block.match(/screenStyle=\{\{\s*height:\s*([A-Z_0-9]+)/)?.[1];
  expect(h, "the phone's screen height").toBeTruthy();
  const height = /^\d+$/.test(h!) ? Number(h) : Number(src.match(new RegExp(`const ${h} = (\\d+);`))?.[1]);
  expect(Number.isFinite(height), `${h} resolves to a number`).toBe(true);
  return { width: Number(widthExpr), height };
}

describe("the homepage Swift Links phone is not long and skinny", () => {
  it("has the centre phone's proportions (within 3%)", () => {
    const centre = phone("280");
    const links = phone("213");
    const ratio = (p: { width: number; height: number }) => p.height / p.width;
    expect(Math.abs(ratio(links) / ratio(centre) - 1)).toBeLessThan(0.03);
  });

  it("keeps the same centre on the stage (moved down by half the height it lost)", () => {
    expect(src).toMatch(/className="absolute left-0 top-\[140px\] z-10"/);
  });
});
