import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { launchBrowser, appCss } from "./harness";

import FreeDesignChoice from "@/components/FreeDesignChoice";

// ── "Your card uses Pro design" ─────────────────────────────────────────────
//
// This panel sits on the single highest-intent screen in the product, over a
// dimmed backdrop, and it is the last thing someone sees before their card is
// either kept or rewritten. Both of its buttons are decisions, so neither may
// be clipped, wrapped into illegibility, or pushed off a phone screen.
//
// The worst case is the longest one: the custom designer plus a video plus a
// Pro finish plus colours is four lines of changes above two buttons and two
// lines of small print.
const CHANGES = [
  "Your custom design becomes the Classic Pro template",
  "Your Brushed finish becomes Flat",
  "Your background video is removed",
  "Your colors move to the closest free ones",
];

async function render(browser: Browser, width: number, changes = CHANGES) {
  const css = await appCss();
  const markup = renderToStaticMarkup(
    createElement(FreeDesignChoice, {
      changes,
      onKeepWithTrial: () => {},
      onContinueFree: () => {},
    }),
  );
  const page = await browser.newPage();
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
     <style>body{margin:0;padding:20px;background:#0b0f16}</style></head>
     <body class="sc-app">${markup}</body></html>`,
    { waitUntil: "load" },
  );
  await page.waitForTimeout(150);
  return page;
}

describe("the Free design choice panel", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  for (const width of [360, 390, 1280]) {
    it(`fits at ${width}px`, async () => {
      const page = await render(browser, width);
      try {
        const res = await page.evaluate(() => {
          const limit = window.innerWidth + 1;
          const spills: string[] = [];
          document.querySelectorAll("body *").forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.right > limit || r.left < -1)) spills.push(`${el.tagName}.${el.className}`.slice(0, 70));
          });
          return { spills, sideways: document.documentElement.scrollWidth > window.innerWidth };
        });
        expect(res.spills, `elements spill outside the viewport at ${width}px`).toEqual([]);
        expect(res.sideways, `the page scrolls sideways at ${width}px`).toBe(false);
      } finally { await page.close(); }
    });
  }

  it("gives both decisions a real tap target on a phone", async () => {
    const page = await render(browser, 390);
    try {
      const buttons = await page.evaluate(() =>
        [...document.querySelectorAll("button")].map((b) => ({
          text: (b.textContent ?? "").trim(),
          h: b.getBoundingClientRect().height,
          w: b.getBoundingClientRect().width,
        })),
      );
      expect(buttons.length, "both buttons must render").toBe(2);
      for (const b of buttons) {
        // Apple's 44px floor. A decision this consequential must not be a
        // cramped target, and the secondary least of all — a hard-to-hit exit
        // is what turns an honest choice into a dark pattern.
        expect(b.h, `"${b.text}" is only ${Math.round(b.h)}px tall`).toBeGreaterThanOrEqual(44);
        expect(b.w).toBeGreaterThan(200);
      }
    } finally { await page.close(); }
  });

  it("never lets a button's label overflow its own box", async () => {
    const page = await render(browser, 360);
    try {
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll("button")]
          .filter((b) => b.scrollWidth > b.clientWidth + 1)
          .map((b) => (b.textContent ?? "").trim()),
      );
      expect(clipped, "a button label is clipped").toEqual([]);
    } finally { await page.close(); }
  });

  it("keeps the change list readable — one line per change, in order", async () => {
    const page = await render(browser, 390);
    try {
      const items = await page.evaluate(() => [...document.querySelectorAll("li")].map((li) => (li.textContent ?? "").replace("→", "").trim()));
      expect(items).toEqual(CHANGES);
    } finally { await page.close(); }
  });

  it("keeps the small print legible — disclosure and reassurance alike", async () => {
    // The billing disclosure has to be readable whether or not anyone wants to
    // read it, and the line that makes Free feel safe has to be as readable as
    // the one that makes Pro attractive. The app's usual gray-500/600 small
    // print measures 3.97:1 and 2.54:1 on this backdrop — both under AA.
    const page = await render(browser, 390);
    try {
      const worst = await page.evaluate(() => {
        const srgb = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
        const lum = (rgb: string) => {
          const [r, g, b] = rgb.match(/\d+/g)!.slice(0, 3).map((n) => srgb(Number(n) / 255));
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const bg = lum(getComputedStyle(document.body).backgroundColor);
        let lowest = 99;
        let which = "";
        document.querySelectorAll("p").forEach((p) => {
          const t = (p.textContent ?? "").trim();
          if (!/card required|You keep your card/.test(t)) return;
          const l = lum(getComputedStyle(p).color);
          const ratio = (Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05);
          if (ratio < lowest) { lowest = ratio; which = t.slice(0, 40); }
        });
        return { lowest, which };
      });
      expect(worst.lowest, `"${worst.which}" measures ${worst.lowest.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    } finally { await page.close(); }
  });

  it("reads correctly with a single change too", async () => {
    const page = await render(browser, 390, ["Your Brushed finish becomes Flat"]);
    try {
      const text = await page.evaluate(() => document.body.innerText);
      expect(text).toContain("Your card uses Pro design");
      expect(text).toContain("Your Brushed finish becomes Flat");
      expect(text).toContain("Continue with Free");
    } finally { await page.close(); }
  });
});
