import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The public card page carried one light line under the card — "Swipe down to
// view socials and more" (2026-09-20) — and a tightened gap beneath it. The
// owner removed both (2026-09-24): the card is followed by "Save …'s contact"
// at the page's ordinary spacing, exactly as before the line existed.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("no scroll hint under the public card", () => {
  const page = read("src/app/[username]/page.tsx");

  it("the line and its words are gone", () => {
    expect(page).not.toMatch(/down to view socials and more|down to save \$\{firstName\}|sc-hint-swipe|sc-hint-scroll/);
    expect(read("src/app/globals.css")).not.toMatch(/\.sc-hint-(swipe|scroll)/);
    expect(read("src/lib/knowledge/docs/product.ts")).not.toMatch(/Swipe down to view socials/);
  });

  it("the card block has no negative margin: the page's gap-5 spaces it like every other section", () => {
    expect(page).toContain('<div className="w-full max-w-sm sc-card-settle">');
    expect(page).not.toMatch(/sc-card-settle -mb-/);
  });
});
