// ── The upgrade sheet, measured on a phone ──────────────────────────────────
//
// This is the one dialog in the product whose whole job is to make someone want
// to upgrade, and it appears at the exact moment they are most likely to. If it
// overflows a small phone, hides its own buttons behind the home indicator, or
// pushes the page sideways, it does the opposite of its job. So it gets
// measured rather than eyeballed — including with four Pro features listed,
// which is the tallest it can ever be.

import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { chromium, type Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { appCss } from "./harness";

vi.mock("@/lib/platform", () => ({ useIsNativeApp: () => false }));
const { default: ProRequiredDialog } = await import("@/components/ProRequiredDialog");

const WIDTHS = [
  { name: "iPhone SE (small)", width: 320, height: 568 },
  { name: "iPhone 13 Mini", width: 375, height: 629 },
  { name: "iPhone 13", width: 390, height: 664 },
  { name: "Pixel 5", width: 393, height: 700 },
  { name: "desktop", width: 1280, height: 900 },
];

// The worst case: everything a card can have that needs Pro.
const FEATURES = ["Your own custom design", "Gilt edge finish", "Background video", "Your own colors"];

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

async function probe(width: number, height: number) {
  const css = await appCss();
  const html = renderToStaticMarkup(
    createElement(ProRequiredDialog, {
      features: FEATURES,
      onSaveWithoutPro: () => {},
      onCancel: () => {},
    }),
  );
  const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 500, isMobile: width < 500 });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1">` +
        `<style>${css}</style></head><body class="sc-app" style="margin:0">` +
        `<div style="height:2000px"></div>${html}</body></html>`,
      { waitUntil: "load" },
    );
    return await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')!;
      const sheet = dialog.querySelector(":scope > div")!;
      const r = (e: Element) => e.getBoundingClientRect();
      const sr = r(sheet);
      const actions = Array.from(sheet.querySelectorAll("a, button"));
      return {
        sheet: { t: sr.top, b: sr.bottom, l: sr.left, rr: sr.right, h: sr.height, w: sr.width },
        vw: innerWidth,
        vh: innerHeight,
        docOverflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        // Every action must be inside the viewport and big enough to hit.
        actions: actions.map((a) => {
          const b = r(a);
          return {
            label: (a.textContent ?? "").trim().slice(0, 22),
            h: Math.round(b.height),
            inView: b.top >= -0.5 && b.bottom <= innerHeight + 0.5,
            insideSheet: b.left >= sr.left - 0.5 && b.right <= sr.right + 0.5,
          };
        }),
        // Nothing may be cut off horizontally inside the sheet.
        clipped: Array.from(sheet.querySelectorAll("*")).filter((e) => {
          const b = r(e);
          return b.width > 0 && (b.left < sr.left - 0.5 || b.right > sr.right + 0.5);
        }).length,
        scrollsInsideItself: sheet.scrollHeight > sheet.clientHeight + 1,
        maxH: getComputedStyle(sheet).maxHeight,
      };
    });
  } finally {
    await page.close();
  }
}

describe.each(WIDTHS)("$name", ({ width, height }) => {
  let p: Awaited<ReturnType<typeof probe>>;
  beforeAll(async () => { p = await probe(width, height); }, 90_000);

  it("never pushes the page sideways", () => {
    expect(p.docOverflowX).toBe(0);
  });

  it("sits inside the screen on every edge", () => {
    expect(p.sheet.l).toBeGreaterThanOrEqual(-0.5);
    expect(p.sheet.rr).toBeLessThanOrEqual(p.vw + 0.5);
    expect(p.sheet.b).toBeLessThanOrEqual(p.vh + 0.5);
    expect(p.sheet.t).toBeGreaterThanOrEqual(-0.5);
  });

  it("shows every action, in the viewport", () => {
    expect(p.actions.length).toBeGreaterThanOrEqual(3);
    expect(p.actions.filter((a) => !a.inView)).toEqual([]);
  });

  it("keeps every action inside the sheet", () => {
    expect(p.actions.filter((a) => !a.insideSheet)).toEqual([]);
  });

  it("gives every action a real tap target", () => {
    // 40px is the floor a thumb can hit reliably; the tertiary link is smaller
    // on purpose but still has to clear 30.
    expect(p.actions.filter((a) => a.h < 30)).toEqual([]);
    expect(p.actions.filter((a) => a.label.includes("Upgrade") && a.h < 40)).toEqual([]);
  });

  it("cuts nothing off horizontally", () => {
    expect(p.clipped).toBe(0);
  });

  // The tallest possible sheet on the shortest phone must scroll INSIDE itself
  // rather than run off the bottom taking the buttons with it.
  it("is capped so it can never outgrow the screen", () => {
    expect(p.maxH).not.toBe("none");
    expect(p.sheet.h).toBeLessThanOrEqual(p.vh + 0.5);
  });
});

describe("the native shell gets no price and no CTA", () => {
  it("renders neither the price block nor the upgrade link", async () => {
    vi.resetModules();
    vi.doMock("@/lib/platform", () => ({ useIsNativeApp: () => true }));
    const { default: NativeDialog } = await import("@/components/ProRequiredDialog");
    const html = renderToStaticMarkup(
      createElement(NativeDialog, { features: FEATURES, onSaveWithoutPro: () => {}, onCancel: () => {} }),
    );
    expect(html).not.toContain("/upgrade");
    expect(html).not.toContain("Upgrade to Pro");
    expect(html).not.toMatch(/\$\d/);
    expect(html).not.toMatch(/month/i);
    // It still explains itself and still offers the way forward.
    expect(html).toContain("Save without them");
    expect(html).toContain("Background video");
  });
});
