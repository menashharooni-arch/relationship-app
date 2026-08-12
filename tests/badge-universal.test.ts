import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// "Made with SwiftCard" is on EVERY shared card and SwiftLink — every plan
// (owner decision 2026-08-11). It was Free-only before, and the two surfaces
// had even drifted apart, which read as a glitch from the outside. If a paid
// "remove branding" tier ever returns, re-gate BOTH and delete this file.
describe("the SwiftCard badge is universal", () => {
  it("card page: the badge anchor is not plan-gated", () => {
    const c = code("src/app/card/[username]/page.tsx");
    const badge = c.indexOf("src=badge");
    expect(badge, "the badge is gone from the card page").toBeGreaterThan(-1);
    // Only the badge's OWN opening — the faint "Create your card" line above
    // it is still legitimately Free-only, so a wide window would trip on it.
    const anchorStart = c.lastIndexOf("<a", badge);
    const before = c.slice(Math.max(0, anchorStart - 80), anchorStart);
    expect(before, "the badge got re-gated behind a plan check").not.toMatch(/isPaidPlan\([^)]*\)\s*&&|&&\s*\($/);
  });

  it("SwiftLinks: the footer attribution is not plan-gated", () => {
    const c = code("src/components/SwiftLinkProfile.tsx");
    const badge = c.indexOf("src=badge");
    expect(badge).toBeGreaterThan(-1);
    const before = c.slice(Math.max(0, badge - 400), badge);
    expect(before).not.toMatch(/ownerPaid\s*&&|!ownerPaid\s*&&/);
  });
});
