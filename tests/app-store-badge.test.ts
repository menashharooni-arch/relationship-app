import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// The "Download on the App Store" surfaces. There are five of them across the
// site and the post-signup flow, and before this they were copy-pasted markup —
// which is exactly how two badges on one page end up different sizes with
// different hover states, and how a change lands on one and not the others.
// These pin the single-source rule and the placements themselves.

const BADGE = "src/components/AppStoreBadge.tsx";

// Every consumer, and what each one is for.
const CONSUMERS: [string, string][] = [
  ["src/components/site/SiteNav.tsx", "nav, desktop right + mobile bar + menu sheet"],
  ["src/app/page.tsx", "homepage hero"],
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
    const shines = src.match(/rd-appstore-shine/g) ?? [];
    // AppStoreBadge, AppStoreBadgeCompact — GetTheAppCard reuses AppStoreBadge.
    expect(shines.length).toBeGreaterThanOrEqual(2);
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
  it("desktop nav: badge leads the right-hand cluster, ahead of Log in", () => {
    const nav = read("src/components/site/SiteNav.tsx");
    const desktopCluster = nav.slice(nav.indexOf('className="hidden lg:flex items-center gap-2.5'));
    const badge = desktopCluster.indexOf("<AppStoreBadge");
    const login = desktopCluster.indexOf('href="/login"');
    const signup = desktopCluster.indexOf('href="/cards/new"');
    expect(badge).toBeGreaterThan(-1);
    expect(badge).toBeLessThan(login);
    // Signing up stays the primary action and keeps the last, strongest slot.
    expect(signup).toBeGreaterThan(badge);
  });

  // Measured, not guessed: a badge carrying words is 85px and overflows the
  // mobile bar at every phone width up to 430px, and even the 32px square
  // leaves only 2px of slack at 375. 390 is the first width with real room.
  it("mobile nav: the compact square is gated to widths where it fits", () => {
    const nav = read("src/components/site/SiteNav.tsx");
    expect(nav).toMatch(/AppStoreBadgeCompact[^/]*min-\[390px\]:inline-flex/);
    expect(read(BADGE)).toMatch(/h-8 w-8/);
  });

  it("mobile sheet carries the full wording the bar cannot fit", () => {
    const nav = read("src/components/site/SiteNav.tsx");
    const sheet = nav.slice(nav.indexOf("{/* Mobile sheet */}"));
    expect(sheet).toMatch(/<AppStoreBadge[^>]*size="md"/);
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
    expect(renderToStaticMarkup(h(mod.AppStoreBadgeCompact))).toBe("");
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
