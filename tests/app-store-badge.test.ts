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
  ["src/app/page.tsx", "homepage hero, beside \"See how it works\""],
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
  // Owner request 2026-09-03, restated: the badge belongs directly to the RIGHT
  // of "See how it works", on desktop AND on mobile. It was briefly put in the
  // nav and under the claim box instead; these pin the real thing.
  it("hero: the badge is paired with 'See how it works' in a nowrap group", () => {
    const src = read("src/app/page.tsx");
    const cta = src.indexOf('id="hero-cta"');
    const badge = src.indexOf("<AppStoreBadge", cta);
    const claim = src.indexOf("<HeroClaim", cta);
    expect(cta).toBeGreaterThan(-1);
    // Right of the button...
    expect(badge).toBeGreaterThan(cta);
    // ...and ahead of the claim box, which wraps below the pair.
    expect(claim).toBeGreaterThan(badge);
    // The pair shares its own flex group, so the badge stays welded to the
    // button instead of being a loose third child of the wrapping row (where it
    // would drop to its own line the moment the column narrowed).
    const groupOpen = src.lastIndexOf("<div className=\"flex flex-wrap items-center", cta);
    expect(groupOpen).toBeGreaterThan(-1);
    const group = src.slice(groupOpen, claim);
    expect(group).toContain('id="hero-cta"');
    expect(group).toContain("<AppStoreBadge");
  });

  it("hero: the badge is sized to the button's exact height", () => {
    // .rd-btn-lg is padding 1rem + font-size 1rem at line-height 1 + 1px border
    // = 50px. The lg badge is py-2.5 + 30px of label = 50px. If either moves,
    // the two stop lining up.
    expect(read("src/app/page.tsx")).toMatch(/<AppStoreBadge[^>]*size="lg"/);
    const badge = read(BADGE);
    // py-2.5 is what makes the 50px; the horizontal padding is allowed to shrink
    // on phones, the vertical is NOT.
    expect(badge).toMatch(/lg: \{ pad: "px-3 sm:px-4 py-2\.5"/);
    const css = read("src/app/globals.css");
    expect(css).toContain(".rd-btn-lg { padding: 1rem 1.7rem; font-size: 1rem; }");
  });

  // The pair is 327px on a phone. Without wrapping it would push past a 360px
  // Android viewport and give the whole page a horizontal scrollbar.
  it("hero: the pair wraps rather than overflowing a narrow phone", () => {
    expect(read("src/app/page.tsx")).toMatch(/<div className="flex flex-wrap items-center gap-2 sm:gap-3">/);
  });

  // The nav was never asked for and is deliberately left alone.
  it("the marketing nav carries no App Store badge", () => {
    expect(read("src/components/site/SiteNav.tsx")).not.toContain("AppStoreBadge");
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
