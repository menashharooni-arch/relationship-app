import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { launchBrowser, appCss } from "./harness";
import PushPreferencesForm from "@/components/PushPreferencesForm";

// The quiet-hours line grew a second sentence when the 8am catch-up shipped —
// it is now the longest hint on the panel, and it sits in a row beside a switch
// that must not be pushed off the edge of a phone. A source scan cannot see
// that; this measures it at both widths.

async function render(browser: Browser, width: number) {
  const css = await appCss();
  const markup = renderToStaticMarkup(createElement(PushPreferencesForm));
  const page = await browser.newPage();
  await page.setViewportSize({ width, height: 1400 });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
     <style>body{margin:0;padding:16px;background:#F7F3EE}</style></head>
     <body class="sc-app">${markup}</body></html>`,
    { waitUntil: "load" },
  );
  await page.waitForTimeout(150);
  return page;
}

describe("the notification preferences panel", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  for (const width of [390, 1280]) {
    it(`keeps every switch on screen and reachable at ${width}px`, async () => {
      const page = await render(browser, width);
      try {
        const switches = await page.$$('[role="switch"]');
        // Five live categories plus quiet hours.
        expect(switches.length).toBe(6);

        const viewport = width;
        for (const el of switches) {
          const box = await el.boundingBox();
          expect(box, "a switch rendered with no box").toBeTruthy();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(viewport);
          // A 20px-tall control is the drawn switch; the tappable row around it
          // is what matters, and neither may collapse.
          expect(box!.height).toBeGreaterThanOrEqual(16);
        }

        // Nothing may scroll the PAGE sideways on a phone.
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      } finally { await page.close(); }
    });
  }

  it("promises the 8am catch-up on the quiet-hours row, where the person decides", async () => {
    const page = await render(browser, 390);
    try {
      const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
      expect(text).toContain("between 10pm and 8am your own time");
      expect(text).toContain("waiting in one notification at 8am");
      // The two sentences must stay on the quiet-hours row, not drift into a
      // category hint above it.
      const row = await page.evaluate(() => {
        const label = [...document.querySelectorAll("p")].find((p) => p.textContent === "Quiet hours");
        return (label?.parentElement?.textContent ?? "").replace(/\s+/g, " ");
      });
      expect(row).toContain("Whatever happens is waiting in one notification at 8am.");
    } finally { await page.close(); }
  });
});
