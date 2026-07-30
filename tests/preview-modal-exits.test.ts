import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The /preview demo popups (SwiftCard, Swift Links, Swift Signature) all render
// through one FullScreen component, so these guards cover all three at once.
//
// Three ways out, by owner request: the light-grey X, clicking outside, and
// Escape. Two of them have already regressed once — the X was invisible and
// unclickable for a while because the popup sat UNDER the site navbar, which
// trapped visitors inside it.

const root = process.cwd();
const src = readFileSync(join(root, "src/app/preview/PreviewClient.tsx"), "utf8");
const fullScreen = src.slice(src.indexOf("function FullScreen("), src.indexOf("function IframePhone("));

describe("the preview popups can always be closed", () => {
  it("keeps the X", () => {
    expect(fullScreen).toMatch(/aria-label="Close"/);
    expect(fullScreen, "the X no longer closes anything").toMatch(/onClick=\{onClose\}/);
  });

  it("closes on a click outside the phone", () => {
    // e.target === e.currentTarget is what makes "outside" mean outside. Without
    // it, a tap on the phone — or any control inside it — bubbles up and closes
    // the very thing the visitor is trying to use.
    expect(fullScreen, "clicking outside no longer closes the popup").toMatch(
      /onClick=\{\(e\) => \{ if \(e\.target === e\.currentTarget\) onClose\(\); \}\}/,
    );
  });

  it("closes on Escape", () => {
    expect(fullScreen).toMatch(/e\.key === "Escape"/);
    expect(fullScreen, "the Escape listener is never cleaned up").toMatch(/removeEventListener\("keydown"/);
  });

  it("sits above the site chrome, or the X is unclickable", () => {
    // The regression that trapped people: popup at z-50 under a z-[70] navbar
    // exactly as tall as the popup's header, so the X was covered.
    // Match the className, NOT the bare token: the comment above it explains
    // "z-[100]: must sit ABOVE every piece of site chrome", so a loose regex
    // matches the comment and passes even after the class drops back to z-50.
    expect(fullScreen, "the popup's own class is no longer z-[100]").toMatch(
      /className="fixed inset-0 z-\[100\]/,
    );
    const nav = readFileSync(join(root, "src/components/site/SiteNav.tsx"), "utf8");
    const navZ = Number((nav.match(/z-\[(\d+)\]/) ?? [])[1] ?? 0);
    expect(navZ, "could not read the navbar z-index").toBeGreaterThan(0);
    expect(100, "the popup no longer outranks the navbar").toBeGreaterThan(navZ);
  });
});
