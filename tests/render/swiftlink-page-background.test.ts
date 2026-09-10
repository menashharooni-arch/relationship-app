import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ComponentProps } from "react";
import { launchBrowser, appCss } from "./harness";

import SwiftLinkProfile from "@/components/SwiftLinkProfile";

type ProfileProps = ComponentProps<typeof SwiftLinkProfile>;

// ── The Swift Links page BACKGROUND, measured in a real browser ─────────────
//
// A source scan cannot see any of what matters here. Whether the photo actually
// covers the page, whether the sheet on top of it is transparent or is quietly
// painting a solid rectangle over the whole thing, whether the text ends up
// white on a dark photo or near-black on a dark photo — all of it is computed
// style and layout, and all of it is the difference between a beautiful page
// and an unreadable one.
//
// The four things this pins:
//   1. The media layer covers the sheet exactly, with object-fit: cover.
//   2. The sheet paints NOTHING over it (this is the one that silently ruins
//      the feature — sheetBg is opaque and covers the page from the avatar
//      down).
//   3. Over media the text is white and the chrome is dark-mode, whatever the
//      Look says. A light Look's #111827 body text on a dimmed photo is the
//      failure mode a background feature must not be able to produce.
//   4. It renders ONLY under the compact-circle header. Cover, banner and
//      "no header" pages must be untouched by a stored background.

// A bright photo, so a missing scrim or a dark-text regression is unmissable.
const PHOTO = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600"><rect width="900" height="1600" fill="#f2d16b"/></svg>',
);

const LINKS = [
  { emoji: "", label: "Client testimonials", url: "https://example.com/a", size: "compact" as const },
  { emoji: "", label: "My listings", url: "https://example.com/b", size: "compact" as const },
];

// Typed against the component, so a prop rename breaks this file loudly
// instead of being cast away.
const BASE: Omit<ProfileProps, "pageStyle"> = {
  name: "Kelsie Blevins",
  username: "kelsie-blevins",
  photoUrl: null,
  logoUrl: null,
  subtitle: "Serving you with integrity",
  bio: "Realtor, CLHMS.",
  verified: false,
  socials: [],
  links: LINKS,
  appUrl: "https://swiftcard.me",
  embedded: true,
  paidTiles: true,
};

type Probe = {
  hasLayer: boolean;
  layerCoversSheet: boolean;
  mediaTag: string | null;
  objectFit: string | null;
  scrimAlpha: number | null;
  sheetContentBg: string | null;
  nameColor: string | null;
  rowBackdrop: string | null;
  rowBg: string | null;
};

describe("Swift Links page background", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  async function probe(pageStyle: ProfileProps["pageStyle"]): Promise<Probe> {
    const css = await appCss();
    const markup = renderToStaticMarkup(
      createElement(SwiftLinkProfile, { ...BASE, pageStyle }),
    ).replaceAll("https://media.test/photo", PHOTO);

    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: 430, height: 900 });
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
         <style>body{margin:0;background:#555}</style></head>
         <body><div style="width:430px">${markup}</div></body></html>`,
        { waitUntil: "load" },
      );
      await page.waitForTimeout(200);

      return await page.evaluate(() => {
        const sheet = document.querySelector(".sc-sl-sheet") as HTMLElement | null;
        if (!sheet) throw new Error("no .sc-sl-sheet in rendered output");
        const layer = sheet.querySelector("[data-sc-pagebg]") as HTMLElement | null;
        const media = layer?.querySelector("img, video") as HTMLElement | null;
        const scrim = layer?.querySelector("[data-sc-scrim]") as HTMLElement | null;

        // The content sheet is the element carrying the name — its own
        // background is what would cover the media.
        const name = sheet.querySelector("h1") as HTMLElement | null;
        const sheetContent = name?.closest("div[class*='pb-9']") as HTMLElement | null;
        const row = sheet.querySelector("a[href^='https://example.com']") as HTMLElement | null;

        const sr = sheet.getBoundingClientRect();
        const lr = layer?.getBoundingClientRect();
        const near = (a: number, b: number) => Math.abs(a - b) <= 1;

        const scrimBg = scrim ? getComputedStyle(scrim).backgroundColor : null;
        const alphaOf = (c: string | null) => {
          if (!c) return null;
          const m = /rgba?\(([^)]+)\)/.exec(c);
          if (!m) return null;
          const parts = m[1].split(",").map((n) => Number(n));
          return parts.length === 4 ? parts[3] : 1;
        };

        return {
          hasLayer: !!layer,
          layerCoversSheet: !!lr && near(lr.top, sr.top) && near(lr.left, sr.left)
            && near(lr.width, sr.width) && near(lr.height, sr.height),
          mediaTag: media ? media.tagName.toLowerCase() : null,
          objectFit: media ? getComputedStyle(media).objectFit : null,
          scrimAlpha: alphaOf(scrimBg),
          sheetContentBg: sheetContent ? getComputedStyle(sheetContent).backgroundColor : null,
          nameColor: name ? getComputedStyle(name).color : null,
          rowBackdrop: row ? (getComputedStyle(row).backdropFilter || "none") : null,
          rowBg: row ? getComputedStyle(row).backgroundColor : null,
        };
      });
    } finally {
      await page.close();
    }
  }

  it("covers the whole page and lets the sheet show it through", async () => {
    const r = await probe({
      look: "paper", // a LIGHT look, deliberately — the hard case
      heroStyle: "avatar",
      bgMedia: "https://media.test/photo",
      bgMediaType: "image",
      bgDim: 40,
    });

    expect(r.hasLayer).toBe(true);
    expect(r.layerCoversSheet).toBe(true);
    expect(r.mediaTag).toBe("img");
    // object-contain would letterbox the photo; anything but cover leaves gaps.
    expect(r.objectFit).toBe("cover");
    // The sheet must paint nothing. rgba(0,0,0,0) is transparent; an opaque
    // colour here means the photo is behind a solid rectangle and invisible.
    expect(r.sheetContentBg).toBe("rgba(0, 0, 0, 0)");
    expect(r.scrimAlpha).toBeCloseTo(0.4, 2);
  }, 60_000);

  it("forces white text over media even on a light Look", async () => {
    const withMedia = await probe({
      look: "paper",
      heroStyle: "avatar",
      bgMedia: "https://media.test/photo",
      bgMediaType: "image",
    });
    // Paper's own body text is #111827 — invisible on a dimmed photo.
    expect(withMedia.nameColor).toBe("rgb(255, 255, 255)");

    // …and the Look is untouched when there is no media.
    const noMedia = await probe({ look: "paper", heroStyle: "avatar" });
    expect(noMedia.hasLayer).toBe(false);
    expect(noMedia.nameColor).toBe("rgb(17, 24, 39)");
  }, 60_000);

  it("honours an explicit text colour the owner picked", async () => {
    const r = await probe({
      look: "paper",
      heroStyle: "avatar",
      text: "#fde68a",
      bgMedia: "https://media.test/photo",
      bgMediaType: "image",
    });
    expect(r.nameColor).toBe("rgb(253, 230, 138)");
  }, 60_000);

  it("renders a video background as a <video>, not an <img>", async () => {
    const r = await probe({
      heroStyle: "avatar",
      bgMedia: "https://media.test/photo",
      bgMediaType: "video",
    });
    expect(r.mediaTag).toBe("video");
    expect(r.objectFit).toBe("cover");
  }, 60_000);

  it("frosts the link rows only when asked, and only over media", async () => {
    const glassOn = await probe({
      heroStyle: "avatar",
      bgMedia: "https://media.test/photo",
      bgMediaType: "image",
      glass: true,
    });
    expect(glassOn.rowBackdrop).toContain("blur(20px)");
    expect(glassOn.rowBg).toBe("rgba(255, 255, 255, 0.1)");

    const glassOff = await probe({
      heroStyle: "avatar",
      bgMedia: "https://media.test/photo",
      bgMediaType: "image",
    });
    expect(glassOff.rowBackdrop).toBe("none");

    // Glass with NO media has nothing to blur — a backdrop-filter over a flat
    // sheet just washes the row out for no reason.
    const noMedia = await probe({ heroStyle: "avatar", glass: true });
    expect(noMedia.rowBackdrop).toBe("none");
  }, 60_000);

  it("is ignored by every header except the compact circle", async () => {
    for (const heroStyle of ["cover", "banner", "none", undefined]) {
      const r = await probe({
        heroStyle,
        bgMedia: "https://media.test/photo",
        bgMediaType: "image",
        glass: true,
      });
      expect(r.hasLayer, `heroStyle=${String(heroStyle)}`).toBe(false);
      // …and the rows stay stock: glass follows the media, not the flag.
      expect(r.rowBackdrop, `heroStyle=${String(heroStyle)}`).toBe("none");
    }
  }, 60_000);

  it("refuses a background URL that is not https", async () => {
    // The value arrives through client-writable customization and is printed
    // into a src on a PUBLIC page.
    for (const bad of ["javascript:alert(1)", "http://example.com/a.jpg", "data:text/html,<script>", ""]) {
      const r = await probe({ heroStyle: "avatar", bgMedia: bad, bgMediaType: "image" });
      expect(r.hasLayer, bad || "(empty)").toBe(false);
    }
  }, 60_000);

  it("clamps a nonsense scrim instead of blanking the page", async () => {
    const huge = await probe({ heroStyle: "avatar", bgMedia: "https://media.test/photo", bgDim: 500 });
    expect(huge.scrimAlpha).toBeCloseTo(0.8, 2);

    const negative = await probe({ heroStyle: "avatar", bgMedia: "https://media.test/photo", bgDim: -20 });
    expect(negative.scrimAlpha).toBeCloseTo(0, 2);

    // Missing → the default, not a transparent scrim that leaves text floating
    // on an arbitrary photo.
    const missing = await probe({ heroStyle: "avatar", bgMedia: "https://media.test/photo" });
    expect(missing.scrimAlpha).toBeCloseTo(0.35, 2);
  }, 60_000);
});
