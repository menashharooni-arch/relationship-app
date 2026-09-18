import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { launchBrowser, appCss } from "./harness";
import FollowUpFirst from "@/components/FollowUpFirst";

// Warm-lead plan PR C3. The dashboard's "Follow up first" card on a phone:
// a long name and a long reason must truncate inside the row, and the badge
// and arrow must stay on screen.

const items = [
  { id: "a", name: "Christopher Fairweather-Blenkinsop of Very Long Realty", tier: "hot" as const, reason: "viewed 12× this week, tapped Book a call with me about the listing +3" },
  { id: "b", name: "Priya Shah", tier: "warm" as const, reason: "replied to you" },
];

async function render(browser: Browser, width: number, props: Parameters<typeof FollowUpFirst>[0]) {
  const css = await appCss();
  const markup = renderToStaticMarkup(createElement(FollowUpFirst, props));
  const page = await browser.newPage();
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
     <style>body{margin:0;padding:16px;background:#F7F3EE}</style></head>
     <body class="sc-app">${markup}</body></html>`,
    { waitUntil: "load" },
  );
  await page.waitForTimeout(100);
  return page;
}

describe("Follow up first", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  for (const width of [375, 1280]) {
    it(`keeps every row inside the screen at ${width}px`, async () => {
      const page = await render(browser, width, { items, warmingCount: 0, card: "dana-lee" });
      try {
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        for (const text of ["Hot", "Warm", "→"]) {
          for (const el of await page.getByText(text, { exact: true }).all()) {
            const box = await el.boundingBox();
            expect(box).toBeTruthy();
            expect(box!.x + box!.width).toBeLessThanOrEqual(width);
          }
        }
      } finally { await page.close(); }
    });
  }

  it("renders nothing at all when nobody is warming up", async () => {
    expect(renderToStaticMarkup(createElement(FollowUpFirst, { items: [], warmingCount: 0, card: "x" }))).toBe("");
  });

  it("Free: a count, no names", async () => {
    const html = renderToStaticMarkup(createElement(FollowUpFirst, { items: [], warmingCount: 2, card: "x" }));
    expect(html).toContain("2 contacts are warming up");
    expect(html).not.toMatch(/pro|upgrade|\$/i);
  });
});
