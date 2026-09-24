import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { SITE_SEGMENTS, aasaComponents } from "@/lib/universal-links";

// ── Card links open in the app (so an owner's own opens are recognised) ─────
// Owner, 2026-09-23: opening your own card on your own phone must never count
// as a view. The app is signed in; Safari usually isn't. So on an iPhone with
// the app, a card link / QR / NFC tap opens the app — and nothing else of the
// site does. Apple's rule: components are tried in order, first match wins.

function glob(pattern: string, path: string): boolean {
  const re = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
  return re.test(path);
}
function opensApp(path: string): boolean {
  for (const c of aasaComponents() as { "/": string; exclude?: boolean }[]) {
    if (glob(c["/"], path)) return !c.exclude;
  }
  return false;
}

describe("which links open the app", () => {
  it.each([
    ["/aaronlavi-swiftcardinc", true],
    ["/danalee-meridianbank", true],
    ["/links/danalee-meridianbank", true],
    ["/card/danalee-meridianbank", true],
    ["/join/abc", true],
    ["/auth/callback", true],
    ["/", false],
    ["/pricing", false],
    ["/dashboard", false],
    ["/cards/new", false],
    ["/api/wallet/pass/abc", false],
    ["/auth/confirm", false],
    ["/sw.js", false],
    ["/robots.txt", false],
    ["/signup", false],
    ["/r/ABC123", false],
    ["/for/realtors", false],
    ["/blog/some-post", false],
    ["/icon-512.png", false],
  ])("%s → app: %s", (path, app) => {
    expect(opensApp(path)).toBe(app);
  });
});

describe("every page and file of the site is listed, so none of them opens the app", () => {
  // Top-level segments the app SHOULD open (cards) or handles on purpose.
  const handled = new Set(["[username]", "card", "links", "join", ".well-known"]);
  const fileToUrl = (f: string): string | null => {
    if (/^(layout|page|not-found|error|loading|global-error|template)\.tsx?$/.test(f)) return null; // not a URL
    if (/\.(css)$/.test(f)) return null;
    if (f === "robots.ts") return "robots.txt";
    if (f === "sitemap.ts") return "sitemap.xml";
    if (f === "manifest.ts") return "manifest.webmanifest";
    if (/^opengraph-image\.(tsx?|png|jpg)$/.test(f)) return "opengraph-image";
    return f; // icon.png, apple-icon.png …
  };

  it("src/app", () => {
    const missing: string[] = [];
    for (const e of readdirSync("src/app", { withFileTypes: true })) {
      const url = e.isDirectory() ? e.name : fileToUrl(e.name);
      if (!url || handled.has(url)) continue;
      if (!(SITE_SEGMENTS as readonly string[]).includes(url)) missing.push(url);
    }
    expect(missing, "add these to SITE_SEGMENTS in src/lib/universal-links.ts").toEqual([]);
  });

  it("public/", () => {
    const missing = readdirSync("public").filter((f) => !(SITE_SEGMENTS as readonly string[]).includes(f));
    expect(missing, "add these to SITE_SEGMENTS in src/lib/universal-links.ts").toEqual([]);
  });
});
