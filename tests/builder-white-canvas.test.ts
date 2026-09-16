import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── The card builder's canvas is white — everywhere it opens ─────────────────
//
// Owner request: the page behind "Get started free" and every similar button is
// white, not the app cream. It was first built in a side worktree, never merged,
// and so never reached swiftcard.me at ANY width; the owner saw it on a computer
// and not on a phone (2026-09-16). These pin every piece a phone or the iPhone
// app needs, not just the desktop page:
//   • both builder screens (the steps, and "You have an unfinished card")
//   • the loading skeleton shown while the builder opens (else: cream flash)
//   • the iPhone shell's own canvas behind the status bar and bounce-scroll
// and that the rule is scoped: the dashboard and other app screens keep cream.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const css = read("src/app/globals.css");
const wizard = read("src/app/cards/new/NewCardWizard.tsx");

describe("card builder white canvas", () => {
  it("every <main> the builder renders carries the white canvas", () => {
    const mains = wizard.match(/<main className="[^"]*"/g) ?? [];
    expect(mains.length).toBeGreaterThanOrEqual(2);
    for (const m of mains) expect(m).toContain("sc-canvas-white");
  });

  it("the builder's loading skeleton is white too", () => {
    expect(read("src/app/cards/new/loading.tsx")).toMatch(/<PortalSkeleton[^>]*whiteCanvas/);
  });

  it("other skeletons keep the cream (opt-in, not a new default)", () => {
    expect(read("src/components/PortalSkeleton.tsx")).toMatch(/whiteCanvas = false/);
    for (const p of ["src/app/cards/[id]/edit/loading.tsx", "src/app/contacts/loading.tsx", "src/app/grow/loading.tsx"]) {
      expect(read(p), p).not.toContain("whiteCanvas");
    }
  });

  it("the light theme paints it white, with no width condition", () => {
    const rule = css.match(/\[data-sc-theme="light"\] \.sc-app\.sc-canvas-white \{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/background-color: #FFFFFF !important/);
    // Not inside a media query: phone and computer get the same page.
    const before = css.slice(0, css.indexOf(rule));
    const opens = (before.match(/@media[^{]*\{/g) ?? []).length;
    const depth = before.split("{").length - before.split("}").length;
    expect(opens === 0 || depth === 0, "the white canvas rule must not sit inside a media query").toBe(true);
  });

  it("the iPhone shell's canvas follows the white builder", () => {
    expect(css).toMatch(/html\.native-app\[data-sc-theme="light"\]:has\(main\.sc-canvas-white\) \{ background: #FFFFFF; \}/);
  });
});
