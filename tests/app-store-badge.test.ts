import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// The "Download on the App Store" surfaces. There are four of them across the
// site and the post-signup flow, and before this they were copy-pasted markup —
// which is exactly how two badges on one page end up different sizes with
// different hover states, and how a change lands on one and not the others.
// These pin the single-source rule and the placements themselves.

const BADGE = "src/components/AppStoreBadge.tsx";

// Every consumer, and what each one is for.
const CONSUMERS: [string, string][] = [
  ["src/components/site/SiteNav.tsx", "desktop header, left of Log in"],
  ["src/components/site/SiteFooter.tsx", "footer"],
  ["src/components/WelcomePlan.tsx", "/welcome — card is live (new signup)"],
  ["src/app/cards/new/NewCardWizard.tsx", "wizard step 5 — card is live (signed in)"],
];

describe("one badge, rendered everywhere", () => {
  it.each(CONSUMERS)("%s imports the shared badge (%s)", (file) => {
    expect(read(file)).toMatch(/from "@\/components\/AppStoreBadge"/);
  });

  // The Apple glyph path is the tell: if it appears anywhere else, someone has
  // hand-rolled a second badge and the two will drift.
  it("the Apple glyph is defined in exactly one file", () => {
    const glyphStart = "M16.365 1.43c0 1.14-.417 2.2-1.11 2.98";
    const offenders = CONSUMERS.map(([f]) => f).filter((f) => read(f).includes(glyphStart));
    expect(offenders).toEqual([]);
    expect(read(BADGE)).toContain(glyphStart);
  });
});

describe("the shine", () => {
  // Owner request 2026-09-03: every App Store button carries the reflection
  // sweep. All three variants, or it is not "everywhere".
  it("every badge variant renders the shine element", () => {
    const src = read(BADGE);
    // One definition, and GetTheAppCard reuses AppStoreBadge, so every rendered
    // badge on the site carries it.
    expect(src).toContain("rd-appstore-shine");
  });

  it("the sweep is defined once, with a keyframe, and clipped to the pill", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain(".rd-appstore-shine");
    expect(css).toContain("@keyframes rd-appstore-shine");
    // Without relative+overflow-hidden on the anchor the band sweeps across
    // whatever sits next to the badge instead of across the badge.
    expect(read(BADGE)).toMatch(/relative overflow-hidden/);
  });

  it("respects prefers-reduced-motion", () => {
    const css = read("src/app/globals.css");
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/\.rd-appstore-shine\s*\{[^}]*animation:\s*none/);
  });
});

describe("placement", () => {
  // Owner decision 2026-09-03 (evening): NO badge in the homepage hero. The
  // morning's request had put one directly right of "See how it works"; the
  // owner then removed exactly that one — the header and footer badges stay.
  // "See how it works" itself and the claim box are untouched.
  it("hero: there is no App Store badge next to 'See how it works'", () => {
    const src = read("src/app/page.tsx");
    expect(src).not.toContain("<AppStoreBadge");
    expect(src).not.toMatch(/from "@\/components\/AppStoreBadge"/);
    // The button and the claim box are still there, in that order.
    const cta = src.indexOf('id="hero-cta"');
    expect(cta).toBeGreaterThan(-1);
    expect(src.slice(cta)).toContain("See how it works");
    expect(src.indexOf("<HeroClaim", cta)).toBeGreaterThan(cta);
  });

  // Owner kept the header badge on desktop (2026-09-03) — but ONLY there. The
  // mobile bar carries the logo, Get started and the menu trigger inside 375px;
  // a badge with words needs 85px it does not have, and the icon-only version
  // that does fit was a compromise nobody asked for.
  it("nav: the badge is in the desktop cluster and nowhere else", () => {
    const nav = read("src/components/site/SiteNav.tsx");
    const uses = [...nav.matchAll(/<AppStoreBadge/g)];
    expect(uses).toHaveLength(1);

    // It must live inside the `hidden lg:flex` cluster, which is what keeps it
    // off phones. Bound the slice at the mobile cluster that follows.
    const desktopStart = nav.indexOf('className="hidden lg:flex items-center gap-2.5');
    const mobileStart = nav.indexOf('className="flex items-center gap-1.5 sm:gap-2 lg:hidden"');
    expect(desktopStart).toBeGreaterThan(-1);
    expect(mobileStart).toBeGreaterThan(desktopStart);
    const desktopCluster = nav.slice(desktopStart, mobileStart);
    expect(desktopCluster).toContain("<AppStoreBadge");
    // Ahead of Log in, behind Get started free.
    expect(desktopCluster.indexOf("<AppStoreBadge")).toBeLessThan(desktopCluster.indexOf('href="/login"'));
    expect(desktopCluster.indexOf('href="/cards/new"')).toBeGreaterThan(desktopCluster.indexOf("<AppStoreBadge"));

    // Nothing in the mobile bar or the menu sheet.
    expect(nav.slice(mobileStart)).not.toContain("<AppStoreBadge");
  });

  // Owner request: the moment a card is created is where the app gets offered.
  // BOTH "Your card is live!" screens, or the two drift apart.
  it.each([
    ["src/components/WelcomePlan.tsx"],
    ["src/app/cards/new/NewCardWizard.tsx"],
  ])("%s offers the app right after the notifications switch", (file) => {
    const src = read(file);
    const push = src.indexOf("<EnablePushButton />");
    const card = src.indexOf("<GetTheAppCard");
    expect(push).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(push);
  });

  // Inside the app itself, "download the app" is nonsense.
  it("the card-created block is hidden in the native shell", () => {
    const src = read(BADGE);
    const block = src.slice(src.indexOf("export function GetTheAppCard"));
    expect(block).toMatch(/<NativeHidden>/);
  });
});

describe("self-activating contract", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllEnvs(); });

  // Same rule as every other APP_STORE_URL consumer: nothing renders until the
  // listing exists, so a badge can be placed anywhere without shipping a dead
  // link. Every variant must honour it — a new one that forgets would render a
  // link to nowhere.
  it("renders nothing when NEXT_PUBLIC_APP_STORE_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement: h } = await import("react");
    const mod = await import("@/components/AppStoreBadge");
    expect(renderToStaticMarkup(h(mod.default))).toBe("");
    expect(renderToStaticMarkup(h(mod.GetTheAppCard))).toBe("");
  });

  it("renders a real, labelled link once the listing is live", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "https://apps.apple.com/app/id6798875872");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement: h } = await import("react");
    const mod = await import("@/components/AppStoreBadge");
    const out = renderToStaticMarkup(h(mod.default));
    expect(out).toContain("https://apps.apple.com/app/id6798875872");
    expect(out).toContain('aria-label="Download SwiftCard on the App Store"');
    expect(out).toContain("rd-appstore-shine");
    // Opens out of the site; never without noopener.
    expect(out).toContain('rel="noopener noreferrer"');
  });
});
