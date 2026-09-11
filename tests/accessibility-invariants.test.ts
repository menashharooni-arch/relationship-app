import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ── The accessibility work, pinned ───────────────────────────────────────────
//
// Apple's Accessibility Nutrition Labels are a DECLARATION: you tick VoiceOver,
// Larger Text, Reduced Motion and so on in App Store Connect, and Apple expects
// the claim to stay true. Everything below is a property that has to hold for a
// label we tick, so that a later change breaks a test instead of quietly
// breaking the claim.
//
// Measured, not asserted: scripts/qa-a11y.mjs runs axe-core plus six checks in
// a real browser, and scripts/qa-mac.mjs drives the app as the iPhone-on-Mac
// build. These tests pin the invariants those harnesses proved.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const css = () => read("src/app/globals.css");

function globTsx(dir = join(root, "src"), out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) globTsx(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("Larger Text — every size scales with the root", () => {
  it("no component pins a text size in px", () => {
    // 1006 arbitrary px sizes were converted to rem on 2026-09-09. At the 16px
    // default they render identically (all 161 render tests still pass); the
    // difference is that the root font-size can now move them, which is what
    // Dynamic Type does. A single new text-[13px] silently stops scaling.
    const offenders: string[] = [];
    for (const f of globTsx()) {
      // The card templates are EXEMPT and must stay exempt: the same markup is
      // rendered to a PNG, an Apple Wallet pass and an OG image at exact pixel
      // sizes, so its type must not move. TemplateStyleControls edits those
      // fixed sizes, so it names them too.
      if (f.includes("/card-templates/")) continue;
      const hits = read(f.replace(root + "/", "")).match(/text-\[\d+(\.\d+)?px\]/g);
      if (hits) offenders.push(`${f.replace(root + "/", "")}: ${hits.slice(0, 3).join(" ")}`);
    }
    expect(
      offenders,
      "Use a rem arbitrary value (11px → text-[0.6875rem]) so iOS Larger Text can scale it.",
    ).toEqual([]);
  });

  it("the root font-size is driven by --sc-text-scale, and clamped", () => {
    const s = css();
    expect(/--sc-text-scale:\s*1/.test(s)).toBe(true);
    expect(/font-size:\s*calc\(16px \* clamp\(/.test(s)).toBe(true);
  });

  it("the native shell actually sets that variable from Dynamic Type", () => {
    const vc = read("ios/App/App/MainViewController.swift");
    expect(vc).toMatch(/preferredContentSizeCategory/);
    expect(vc).toMatch(/--sc-text-scale/);
    // A fresh document resets the variable, so it must be re-applied on
    // navigation — the shell loads a REMOTE origin and navigates for real.
    expect(vc).toMatch(/applyTextScale\(\)/);
    expect(vc).toMatch(/traitCollectionDidChange/);
  });
});

describe("keyboard operability — the focus ring cannot be switched off", () => {
  it("globals.css carries an unlayered :focus-visible ring", () => {
    const s = css();
    expect(s).toMatch(/:focus-visible\s*\{[^}]*outline:/);
    // Unlayered is the whole mechanism: Tailwind's focus:outline-none lives in
    // @layer utilities, and an unlayered rule outranks every layered one
    // regardless of specificity. If this ever moves inside @layer, 82 controls
    // lose their ring again.
    const idx = s.indexOf(":focus-visible");
    const before = s.slice(0, idx);
    const opens = (before.match(/@layer[^;{]*\{/g) || []).length;
    expect(opens === 0 || !/@layer[^;{]*\{[^}]*$/.test(before)).toBe(true);
  });

  it("forced-colors mode hands the ring to the OS", () => {
    expect(css()).toMatch(/@media \(forced-colors: active\)/);
  });
});

describe("Reduced Motion — a catch-all, not a list", () => {
  it("globals.css neutralises animation globally under reduce", () => {
    const s = css();
    const block = s.slice(s.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/\*,\s*\*::before,\s*\*::after/);
    expect(block).toMatch(/animation-duration:\s*0\.001ms\s*!important/);
  });

  it("keeps colour and opacity transitions — motion is the trigger, not change", () => {
    const s = css();
    const block = s.slice(s.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/transition-property:\s*color, background-color/);
    // ...and never lists a movement property in what survives.
    const kept = block.match(/transition-property:\s*([^;!]*)/)?.[1] ?? "";
    expect(/transform|translate|scale|rotate/.test(kept)).toBe(false);
  });
});

describe("the iPhone app on a Mac", () => {
  it("the shell reports isiOSAppOnMac to the web layer", () => {
    const vc = read("ios/App/App/MainViewController.swift");
    expect(vc).toMatch(/isiOSAppOnMac/);
    expect(vc).toMatch(/scMac/);
    expect(vc).toMatch(/applyPlatformFlags\(\)/);
  });

  it("platform.ts reads the native flag rather than sniffing the user agent", () => {
    const p = read("src/lib/platform.ts");
    expect(p).toMatch(/dataset\.scMac/);
    expect(p).toMatch(/export function useIsIosAppOnMac/);
    // A Mac still reports an iPhone UA and Capacitor platform "ios", so any UA
    // test here would be wrong by construction.
    expect(/navigator\.userAgent[^\n]*Mac/i.test(p)).toBe(false);
  });

  it("Apple Wallet explains itself on a Mac instead of dead-ending", () => {
    const w = read("src/components/AddToWalletButton.tsx");
    expect(w).toMatch(/useIsIosAppOnMac/);
    expect(w).toMatch(/added on your iPhone/i);
  });
});

describe("the App Store review prompt", () => {
  it("uses Apple's own API, never a link to the write-review page", () => {
    const s = read("ios/App/App/AppReview.swift");
    expect(s).toMatch(/AppStore\.requestReview|SKStoreReviewController/);
    expect(/itunes\.apple\.com|apps\.apple\.com.*action=write-review/.test(s)).toBe(false);
  });

  it("is registered — an unregistered Capacitor plugin is silently absent", () => {
    expect(read("ios/App/App/MainViewController.swift")).toMatch(/registerPluginInstance\(AppReviewPlugin\(\)\)/);
    // ...and compiled: a file that is not in the target never runs.
    expect(read("ios/App/App.xcodeproj/project.pbxproj")).toMatch(/AppReview\.swift in Sources/);
  });
});
