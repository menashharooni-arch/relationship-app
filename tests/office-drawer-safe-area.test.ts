import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── The Office member drawer has to clear the Dynamic Island ─────────────────
//
// Owner report 2026-09-06: opening "Manage" on a team member in the iPhone app
// put the avatar, the name and the × close button underneath the status bar —
// unreachable, and visibly clipped.
//
// The cause is structural and applies to any overlay of this shape: the drawer
// is `fixed inset-0`, and a FIXED element is not moved by the safe-area padding
// body carries, so under viewport-fit=cover it opens flush with the physical
// top of the screen. globals.css already documents the same defect and remedy
// for .sc-overlay-topbar (the contact-detail overlay).
//
// Measured with scripts/office-ui-shots.mjs, which emulates the notch through
// CDP (Emulation.setSafeAreaInsetsOverride). That detail matters: without it
// env() resolves to 0 in headless Chromium, every safe-area rule evaluates to
// "no padding", and the probe happily passes a layout that is broken on the
// device. Before: close button at y=20 inside a 59px inset. After: y=79.

const root = process.cwd();
const src = readFileSync(join(root, "src/components/office/TeamList.tsx"), "utf8");

describe("the member drawer", () => {
  it("is still the full-height edge-anchored panel this guards", () => {
    // If it ever becomes a centred modal the insets stop mattering — but so
    // does this test, and it should be deleted deliberately rather than pass by
    // accident on a component that no longer has the problem.
    expect(src).toMatch(/fixed inset-0 z-50 flex justify-end/);
    expect(src).toMatch(/h-full overflow-y-auto/);
  });

  it("pads for BOTH insets, additively", () => {
    const at = src.indexOf("fixed inset-0 z-50 flex justify-end");
    const aside = src.slice(at, src.indexOf("</aside>", at));
    expect(aside).toMatch(/paddingTop: "calc\(1\.25rem \+ env\(safe-area-inset-top\)\)"/);
    expect(aside).toMatch(/paddingBottom: "calc\(1\.25rem \+ env\(safe-area-inset-bottom\)\)"/);
  });

  it("does not re-apply a symmetric p-5 that would fight those paddings", () => {
    // `p-5` sets all four sides. Tailwind's utility and the inline style are in
    // different cascade layers, so leaving it was a coin toss on which won —
    // the horizontal padding is now px-5 and the vertical is the inline rule.
    const at = src.indexOf("fixed inset-0 z-50 flex justify-end");
    const aside = src.slice(at, src.indexOf(">", src.indexOf("<aside", at)));
    expect(aside).toMatch(/\bpx-5\b/);
    expect(aside).not.toMatch(/\bp-5\b/);
  });
});

describe("the QR sheet", () => {
  it("carries the same insets", () => {
    const at = src.indexOf('aria-label={`QR code for');
    const start = src.lastIndexOf("<div", at);
    const block = src.slice(start, at);
    expect(block).toMatch(/env\(safe-area-inset-top\)/);
    expect(block).toMatch(/env\(safe-area-inset-bottom\)/);
    expect(block).not.toMatch(/\bp-5\b/);
  });
});
