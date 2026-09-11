// ── The Apple Watch on the homepage, measured ────────────────────────────────
//
// The owner's report, 2026-09-11: "a lot of stuff is cutting out the borders of
// the Apple Watch, like the time and the SwiftCard. It just doesn't look
// clean." It was true, and no source scan could have seen it: the screen's
// corner radius is a percentage of its own width, the rows were inset by a
// smaller percentage, and the curve ate the first and last glyph of the status
// row. Geometry like that only exists once something is laid out.
//
// So this measures the three things the owner asked for, at the two widths the
// component has (below and above `sm`):
//
//   1. the watch stays SMALL — a face that grows past ~230px reads as a phone
//   2. the QR takes a LARGE part of the face — at least 70% of its width
//   3. every row is fully inside the glass, clear of the corner curve
//
// The clearance figure is not "> 0". A rounded corner means a row can be
// inside the rectangle and still be clipped by the curve, so each row has to
// keep a real margin from the edge.

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { appCss } from "./harness";

const { default: WatchShareImage } = await import("@/components/site/WatchShareImage");

const WIDTHS = [
  { name: "phone", width: 390, phone: true },
  { name: "desktop", width: 1280, phone: false },
];

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

async function probe(width: number, phone: boolean) {
  const css = await appCss();
  const html = renderToStaticMarkup(createElement(WatchShareImage));
  const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: phone, isMobile: phone });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1">` +
        `<style>${css}</style></head>` +
        `<body class="sc-app" style="margin:0;background:#0B1022"><div style="display:flex;justify-content:center;padding:40px">${html}</div></body></html>`,
      { waitUntil: "load" },
    );
    return await page.evaluate(() => {
      const root = document.querySelector('[role="img"]') as HTMLElement;
      const screen = root.querySelector(".bg-black") as HTMLElement;
      const s = screen.getBoundingClientRect();
      const qr = screen.querySelector("[data-qr]") as HTMLElement;
      const q = qr.getBoundingClientRect();
      const rows = [...screen.querySelectorAll("span, p, [data-qr]")].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: (el.textContent || "QR").trim().slice(0, 16),
          // clearance from each glass edge, as a share of the screen's width
          left: (r.left - s.left) / s.width,
          right: (s.right - r.right) / s.width,
          top: (r.top - s.top) / s.height,
          bottom: (s.bottom - r.bottom) / s.height,
        };
      });
      const bands = [...root.children].filter((c) => (c as HTMLElement).className.includes("aspect-[62/34]"))
        .map((c) => c.getBoundingClientRect().height);
      return {
        watchWidth: root.getBoundingClientRect().width,
        watchHeight: root.getBoundingClientRect().height,
        screenWidth: s.width,
        qrShare: q.width / s.width,
        bands,
        rows,
        // Nothing on the SCREEN may reach past the glass. The crown and the
        // glow deliberately sit outside the case, so this asks about content.
        overflow: [...screen.querySelectorAll("*")].some((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1);
        }),
      };
    });
  } finally {
    await page.close();
  }
}

describe("the Apple Watch visual", () => {
  for (const { name, width, phone } of WIDTHS) {
    it(`is small, mostly QR, and fully inside its glass at ${name}`, async () => {
      const m = await probe(width, phone);

      // 1. small
      expect(m.watchWidth).toBeGreaterThan(150);
      expect(m.watchWidth).toBeLessThanOrEqual(230);
      // a watch is taller than it is wide, and not by much
      expect(m.watchHeight / m.watchWidth).toBeGreaterThan(1.5);

      // 2. mostly QR
      expect(m.qrShare).toBeGreaterThanOrEqual(0.70);

      // 3. every row clear of the corner curve
      for (const r of m.rows) {
        expect(r.left, `${r.text} left`).toBeGreaterThanOrEqual(0.07);
        expect(r.right, `${r.text} right`).toBeGreaterThanOrEqual(0.07);
        expect(r.top, `${r.text} top`).toBeGreaterThanOrEqual(0.04);
        expect(r.bottom, `${r.text} bottom`).toBeGreaterThanOrEqual(0.04);
      }

      // the bands are sized by aspect ratio, so they must have real height
      expect(m.bands.length).toBe(2);
      for (const h of m.bands) expect(h).toBeGreaterThan(30);

      expect(m.overflow).toBe(false);
    });
  }
});
