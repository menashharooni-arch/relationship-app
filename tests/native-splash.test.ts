import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");
const markup = read("src/lib/splash/markup.html");
const component = read("src/components/NativeSplash.tsx");
const layout = read("src/app/layout.tsx");

// The iOS launch animation (owner-specified 2026-08-31): lightning across the
// whole screen, the logo emerging from the flash, then the logo's own bolt
// opening onto the app. Everything pinned here is something that broke at
// least once while building it.
describe("native splash", () => {
  it("renders only for the shell, and only once per launch", () => {
    expect(component).toMatch(/isNativeRequest\(/);
    // Without the cookie gate the strike replays on every full page load
    // (sign-out, hard nav) and every request carries the inlined artwork.
    expect(component).toMatch(/c\.get\("sc_splash"\)\?\.value === "1"\) return null/);
    expect(markup).toMatch(/sc_splash=1;path=\/;max-age=120/);
  });

  it("is the first thing in the body, so it is in the first painted frame", () => {
    const body = layout.indexOf("<body");
    const splash = layout.indexOf("<NativeSplash />");
    expect(splash).toBeGreaterThan(body);
    // nothing renders between <body> and the splash except comments
    const between = layout.slice(layout.indexOf(">", body) + 1, splash);
    expect(between.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").trim()).toBe("");
  });

  it("can never eat a tap, and goes inert rather than lingering", () => {
    expect(markup).toMatch(/pointer-events:none/);
    // React owns the subtree, so the overlay is NOT removed from the DOM — it
    // has to end hidden instead, or it would sit over the app forever.
    expect(markup).toMatch(/100%\s*\{ opacity:0; visibility:hidden/);
  });

  it("masks by alpha, never by luminance", () => {
    // mask-mode:luminance turned the black cover layer into nothing and does
    // not exist at all on iOS 15.0-15.3 (the app's deployment target is 15.0).
    // The bolt asset is an opaque bolt on a transparent field, so plain alpha
    // masking is both correct and universally supported.
    expect(markup).not.toMatch(/mask-mode:\s*luminance/);
    expect(markup).not.toMatch(/mask-source-type:\s*luminance/);
  });

  it("uses the shipped icon, rebuildable from it", () => {
    // Two inlined WebP assets — the icon and the bolt mask — both derived from
    // public/icon-512.png by scripts/build-splash-assets.mjs. The mask URL
    // repeats across the prefixed mask properties, so count them by role.
    expect((markup.match(/src="data:image\/webp;base64,/g) ?? []).length).toBe(1);
    expect((markup.match(/url\("data:image\/webp;base64,/g) ?? []).length).toBeGreaterThanOrEqual(1);
    const build = read("scripts/build-splash-assets.mjs");
    expect(build).toMatch(/public\/icon-512\.png/);
    // The icon's corners must be cut transparent — opaque, they showed as a
    // dark box the moment the lightning lit up behind the mark.
    expect(build).toMatch(/roundedAlpha\(SIZE, R\)/);
  });

  it("honours reduced motion", () => {
    expect(markup).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
