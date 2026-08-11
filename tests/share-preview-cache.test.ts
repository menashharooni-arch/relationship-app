import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── A shared link must unfurl every time, not most times ─────────────────────
//
// Reported from the field: texting a card link sometimes showed no preview, and
// sometimes a preview with the headshot or logo missing.
//
// Measured against production before the fix:
//   cache-control: public, max-age=60      x-vercel-cache: MISS  ~2.0s
//   (same URL, 2s later)                   x-vercel-cache: HIT   ~0.1s
//
// So the edge DID cache it — for sixty seconds, with no stale-while-revalidate.
// Every share more than a minute after the previous unfurl paid a full cold
// render, and a messenger that times out shows no preview at all (and often
// remembers that absence). "Sometimes" was the sixty-second window.
//
// Caching hard is safe here because the og:image URL carries
// ?v=<hash of every field in the preview> (metaVersion in page.tsx), so any
// edit that changes the picture also changes the URL. Freshness comes from the
// versioned URL, not from refusing to cache.
//
// The second half of the report is the opposite risk: a render that lost its
// headshot to a slow fetch must NOT be cached hard, or "no headshot" becomes
// permanent for a day. Those two rules are what these tests pin.

const root = process.cwd();
const og = () => readFileSync(join(root, "src/app/card/[username]/opengraph-image.tsx"), "utf8");
const page = () => readFileSync(join(root, "src/app/card/[username]/page.tsx"), "utf8");

describe("a complete preview is cached hard", () => {
  it("serves a stale copy instantly while refreshing", () => {
    // THE fix. Without stale-while-revalidate, every expiry puts a cold render
    // in front of a scraper that will not wait for it.
    expect(og()).toMatch(/const CACHE_COMPLETE = "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800"/);
  });

  it("keeps it at the edge far longer than the old 60s", () => {
    const m = og().match(/CACHE_COMPLETE = "[^"]*s-maxage=(\d+)/);
    expect(Number(m?.[1])).toBeGreaterThanOrEqual(3600);
  });

  it("no send path is left on the old sixty-second header", () => {
    // Every tier used to hardcode its own. A missed one would still glitch.
    expect(og()).not.toMatch(/"Cache-Control": "public, max-age=60, s-maxage=60"/);
    expect(og()).not.toMatch(/"Cache-Control": "public, max-age=60"/);
  });
});

describe("a degraded preview expires quickly", () => {
  it("has its own short policy", () => {
    expect(og()).toMatch(/const CACHE_DEGRADED = "public, max-age=60, s-maxage=60"/);
  });

  it("knows the difference between 'no headshot' and 'lost the headshot'", () => {
    // A card that never had a photo is COMPLETE — it renders initials by
    // design. Only a card that wanted one and failed to embed it is degraded.
    const src = og();
    expect(src).toMatch(/const wantedPhoto = !!meta\.photoUrl;/);
    expect(src).toMatch(/const wantedLogo = !!meta\.logoUrl;/);
    expect(src).toMatch(
      /const complete = \(!wantedPhoto \|\| !!meta\.photoUrl\) && \(!wantedLogo \|\| !!meta\.logoUrl\);/,
    );
  });

  it("passes that verdict to the response", () => {
    expect(og()).toMatch(/toResponse\(<div style=\{\{ width: "100%", height: "100%", display: "flex" \}\}>\{card\}<\/div>, "image\/png", complete\)/);
  });

  it("never caches a branded fallback as if it were the card", () => {
    // Tier 3 is not this person's card at all.
    expect(og()).toMatch(/toResponse\(<BrandFallback \/>, "image\/png", false\)/);
  });

  it("and not the last-resort static bytes either", () => {
    expect(og()).toMatch(/"Cache-Control": CACHE_DEGRADED/);
  });
});

describe("the pixel-perfect capture is cached hard", () => {
  it("uses the complete policy", () => {
    // Tier 1 is a picture of the real card with nothing missing — the best
    // preview there is, and the one most worth keeping at the edge.
    expect(og()).toMatch(/"Content-Type": "image\/jpeg", "Cache-Control": CACHE_COMPLETE/);
  });
});

describe("caching stays safe because the URL is versioned", () => {
  it("the og:image URL carries a content hash", () => {
    // This is what makes a long TTL correct rather than reckless: an edit
    // produces a DIFFERENT url, so nobody is served a stale picture.
    expect(page()).toMatch(/opengraph-image\?v=\$\{metaVersion\(p\)\}/);
  });

  it("that hash covers everything the preview shows", () => {
    // If a field appeared in the image but not in the hash, editing it would
    // leave the old preview cached for a day.
    const fn = page().match(/function metaVersion\([\s\S]*?\n\}/)?.[0] ?? "";
    for (const field of ["name", "title", "company", "photoUrl", "logoUrl", "template", "accentColor"]) {
      expect(fn, `metaVersion must include ${field}`).toMatch(new RegExp(`p\\.${field}\\b`));
    }
  });
});
