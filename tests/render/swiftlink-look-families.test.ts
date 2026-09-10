import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ComponentProps } from "react";
import { launchBrowser, appCss } from "./harness";

import SwiftLinkProfile from "@/components/SwiftLinkProfile";
import { SwiftLinkStyleControls } from "@/components/SwiftLinkDesign";
import { LOOK_FAMILIES, looksInFamily, getLook } from "@/lib/swiftlink-looks";

// ── The three Look families, measured in a real browser ────────────────────
//
// Two claims here that only a browser can settle.
//
// THE GLASS FAMILY IS ACTUALLY GLASS. Its whole reason to exist is a colour
// wash showing through a frosted sheet. Both halves are easy to lose by
// accident: a refactor that treats `sheetBg` as opaque paints over the wash,
// and dropping the backdrop-filter turns the same markup into a flat tint. The
// page still renders either way, and it still passes the contrast tests,
// because the failure is that the design is GONE, not that it is unreadable.
//
// THE PICKER OPENS ON YOUR OWN DESIGN. The grid of every look at once was
// replaced by three dropdowns precisely so the list stops being a wall — which
// only works if the group holding your current look is the one already open.
// An accordion that always opens on the first group would be worse than what it
// replaced, and nothing but layout can tell you which one is open.

type ProfileProps = ComponentProps<typeof SwiftLinkProfile>;
type PickerProps = ComponentProps<typeof SwiftLinkStyleControls>;

const BASE: Omit<ProfileProps, "pageStyle"> = {
  name: "Kelsie Blevins",
  username: "kelsie",
  photoUrl: null,
  logoUrl: null,
  subtitle: "Realtor",
  bio: "Helping buyers and sellers.",
  verified: false,
  socials: [],
  links: [{ emoji: "", label: "My listings", url: "https://example.com/a", size: "compact" }],
  appUrl: "https://swiftcard.me",
  embedded: true,
  paidTiles: true,
};

describe("the Glass family renders as glass", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  async function probe(pageStyle: ProfileProps["pageStyle"]) {
    const css = await appCss();
    const markup = renderToStaticMarkup(createElement(SwiftLinkProfile, { ...BASE, pageStyle }));
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: 430, height: 900 });
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
         <style>body{margin:0;background:#555}</style></head>
         <body><div style="width:430px">${markup}</div></body></html>`,
        { waitUntil: "load" },
      );
      await page.waitForTimeout(150);
      return await page.evaluate(() => {
        const sheet = document.querySelector(".sc-sl-sheet") as HTMLElement;
        const name = sheet.querySelector("h1") as HTMLElement;
        const content = name.closest("div[class*='pb-9']") as HTMLElement;
        const cs = getComputedStyle(content);
        // The wash layer is the only full-bleed child carrying a gradient.
        const layers = [...sheet.children].filter((el) => {
          const s = getComputedStyle(el as HTMLElement);
          return s.position === "absolute" && s.backgroundImage.includes("gradient");
        });
        const wash = layers[0] as HTMLElement | undefined;
        const sr = sheet.getBoundingClientRect();
        const wr = wash?.getBoundingClientRect();
        return {
          hasWash: !!wash,
          washCovers: !!wr && Math.abs(wr.width - sr.width) <= 1 && Math.abs(wr.height - sr.height) <= 1,
          washImage: wash ? getComputedStyle(wash).backgroundImage.slice(0, 40) : null,
          sheetBg: cs.backgroundColor,
          sheetBackdrop: cs.backdropFilter || "none",
          nameColor: getComputedStyle(name).color,
        };
      });
    } finally {
      await page.close();
    }
  }

  it("paints a full-bleed colour wash behind a translucent, blurred sheet", async () => {
    const r = await probe({ look: "aurora" });
    expect(r.hasWash).toBe(true);
    expect(r.washCovers).toBe(true);
    expect(r.washImage).toContain("gradient");
    // TRANSLUCENT: an opaque sheet would hide the wash completely.
    expect(r.sheetBg).toMatch(/^rgba\(/);
    const alpha = Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(r.sheetBg)![1]);
    expect(alpha).toBeGreaterThan(0.2);
    expect(alpha).toBeLessThan(1);
    // FROSTED: without the blur it is a tinted pane, not glass.
    expect(r.sheetBackdrop).toContain("blur");
  }, 60_000);

  it("leaves the Solid and Gradient families opaque and unblurred", async () => {
    for (const look of ["paper", "onyx", "dawn", "ink"]) {
      const r = await probe({ look });
      expect(r.hasWash, look).toBe(false);
      expect(r.sheetBackdrop, look).toBe("none");
      // Opaque: rgb(), or an rgba with alpha 1.
      expect(r.sheetBg, look).not.toMatch(/rgba\([^)]*,\s*0?\.\d+\)/);
    }
  }, 60_000);

  it("a page background photo replaces the wash rather than stacking on it", async () => {
    // Both want the same surface. Two of them at once is a muddied photo.
    const r = await probe({
      look: "aurora",
      heroStyle: "avatar",
      bgMedia: "https://media.test/x.jpg",
      bgMediaType: "image",
    });
    expect(r.sheetBg).toBe("rgba(0, 0, 0, 0)");
    expect(r.nameColor).toBe("rgb(255, 255, 255)");
  }, 60_000);

  it("a custom background colour also replaces the wash", async () => {
    const r = await probe({ look: "frost", bg: "#123456" });
    expect(r.hasWash).toBe(false);
    expect(r.sheetBackdrop).toBe("none");
  }, 60_000);
});

describe("the Look picker's three dropdowns", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  async function pick(props: PickerProps) {
    const css = await appCss();
    const markup = renderToStaticMarkup(createElement(SwiftLinkStyleControls, props));
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: 400, height: 1200 });
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
         <style>body{margin:0;padding:12px;background:#0b0f16}</style></head>
         <body class="sc-app"><div style="width:376px">${markup}</div></body></html>`,
        { waitUntil: "load" },
      );
      await page.waitForTimeout(150);
      return await page.evaluate(() => {
        const rows = [...document.querySelectorAll('button[aria-expanded]')] as HTMLElement[];
        return {
          rowCount: rows.length,
          open: rows.filter((r) => r.getAttribute("aria-expanded") === "true").map((r) => r.innerText.split("\n")[0].trim()),
          labels: rows.map((r) => r.innerText.split("\n")[0].trim()),
          // Every blurb must be fully readable — no ellipsis on the row that
          // has the most explaining to do.
          clipped: rows.filter((r) => {
            const p = [...r.querySelectorAll("span")].find((s) => (s.textContent || "").length > 25);
            return p ? p.scrollWidth > p.clientWidth + 1 : false;
          }).length,
          swatchCount: document.querySelectorAll('button[aria-pressed]').length,
          rowsInsidePanel: rows.every((r) => r.getBoundingClientRect().right <= 376 + 12 + 1),
        };
      });
    } finally {
      await page.close();
    }
  }

  it("shows exactly one row per family, and opens the one holding the selection", async () => {
    const solid = await pick({ value: {}, onChange: () => {} });
    expect(solid.rowCount).toBe(LOOK_FAMILIES.length);
    expect(solid.open).toEqual([getLook(undefined).family === "solid" ? "Solid" : ""]);

    const glass = await pick({ value: { linkLook: "aurora" }, onChange: () => {} });
    expect(glass.open).toEqual(["Glass"]);

    const gradient = await pick({ value: { linkLook: "nebula" }, onChange: () => {} });
    expect(gradient.open).toEqual(["Gradient"]);
  }, 60_000);

  it("renders only the open family's swatches, so the list is never a wall again", async () => {
    const glass = await pick({ value: { linkLook: "aurora" }, onChange: () => {} });
    expect(glass.swatchCount).toBe(looksInFamily("glass").length);
  }, 60_000);

  it("never truncates a family's description, and stays inside the panel", async () => {
    for (const value of [{}, { linkLook: "aurora" }, { linkLook: "ink" }]) {
      const r = await pick({ value, onChange: () => {} });
      expect(r.clipped, JSON.stringify(value)).toBe(0);
      expect(r.rowsInsidePanel, JSON.stringify(value)).toBe(true);
    }
  }, 60_000);

  it("a Free session still opens on its own group with both free looks live", async () => {
    const r = await pick({ value: {}, onChange: () => {}, locked: true });
    expect(r.open).toEqual(["Solid"]);
    expect(r.swatchCount).toBe(looksInFamily("solid").length);
  }, 60_000);
});
