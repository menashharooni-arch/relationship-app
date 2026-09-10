// ── The one iPhone, measured ─────────────────────────────────────────────────
//
// The site used to draw six different phones. Consolidating them onto one frame
// immediately surfaced a bug no source scan could have seen: the Dynamic Island
// is a fraction of the SCREEN width, but each old status bar had its own
// hand-picked padding, so on the 240px phone the signal and wifi glyphs
// rendered UNDERNEATH the Island. It looked like a rendering fault in a
// screenshot of our own product.
//
// So the thing to measure is the thing that broke: at every width the site
// actually uses, the Island and the status bar must not touch.

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { appCss } from "./harness";
import PhoneFrame, { StatusBar, phoneScreenWidth } from "@/components/PhoneFrame";

// Every width a phone is rendered at on the marketing site.
const WIDTHS = [
  { name: "ShareWays", width: 240 },
  { name: "hero showcase", width: 280 },
  { name: "TemplateGallery / LeadCapture", width: 300 },
  { name: "SwiftLinksPhone", width: 340 },
];

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

type Probe = {
  body: { w: number; h: number; radius: number };
  screen: { w: number; h: number; radius: number };
  island: { l: number; r: number; t: number; b: number; w: number; h: number };
  time: { l: number; r: number; t: number; b: number };
  icons: { l: number; r: number; t: number; b: number };
  indicator: { w: number; cx: number; screenCx: number; bottomGap: number } | null;
  buttons: number;
};

async function probe(width: number, statusMode: true | "overlay"): Promise<Probe> {
  const css = await appCss();
  const html = renderToStaticMarkup(
    h(
      PhoneFrame,
      { width, statusBar: statusMode, screenStyle: { height: Math.round(width * 2.0), background: "#FAF7F2" } },
      h("div", { style: { height: 40 } }),
    ),
  );
  const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>` +
        `<body class="sc-app" style="margin:0;padding:40px">${html}</body></html>`,
      { waitUntil: "load" },
    );
    return await page.evaluate(() => {
      const frame = document.querySelector('[role="group"]')!;
      const rect = (e: Element) => {
        const b = e.getBoundingClientRect();
        return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height };
      };
      const px = (e: Element, prop: string) => parseFloat(getComputedStyle(e)[prop as never] as string);

      // The rail is the frame's only element child; the screen is the deepest
      // box that carries overflow:hidden.
      const railEl = frame.firstElementChild!;
      const bezelEl = railEl.querySelector(":scope > div")!;
      const screenEl = bezelEl.querySelector(":scope > div")!;

      const spans = Array.from(screenEl.querySelectorAll(":scope > span, :scope > div > span"));
      const island = spans.find((s) => getComputedStyle(s).backgroundColor === "rgb(0, 0, 0)")!;
      const indicator = spans.find((s) => {
        const bg = getComputedStyle(s).backgroundColor;
        return bg.startsWith("rgba(15, 23, 42") || bg.startsWith("rgba(255, 255, 255");
      });

      const bar = screenEl.querySelector('[aria-hidden="true"].flex.items-center.justify-between')!;
      const time = bar.firstElementChild!;
      const icons = bar.lastElementChild!;
      const sr = rect(screenEl);

      return {
        body: { w: rect(railEl).w, h: rect(railEl).h, radius: px(railEl, "borderTopLeftRadius") },
        screen: { w: sr.w, h: sr.h, radius: px(screenEl, "borderTopLeftRadius") },
        island: rect(island),
        time: rect(time),
        icons: rect(icons),
        indicator: indicator
          ? {
              w: rect(indicator).w,
              cx: (rect(indicator).l + rect(indicator).r) / 2,
              screenCx: (sr.l + sr.r) / 2,
              bottomGap: sr.b - rect(indicator).b,
            }
          : null,
        buttons: railEl.querySelectorAll(":scope > span").length,
      };
    });
  } finally {
    await page.close();
  }
}

describe.each(WIDTHS)("$name ($width px)", ({ width }) => {
  let flow: Probe;
  let overlay: Probe;
  beforeAll(async () => {
    flow = await probe(width, true);
    overlay = await probe(width, "overlay");
  }, 90_000);

  // THE BUG THIS FILE EXISTS FOR.
  it("the Dynamic Island never touches the clock", () => {
    for (const p of [flow, overlay]) {
      expect({ width, timeRight: Math.round(p.time.r), islandLeft: Math.round(p.island.l) }).toMatchObject({
        timeRight: expect.any(Number),
      });
      expect(p.island.l).toBeGreaterThan(p.time.r);
    }
  });

  it("the Dynamic Island never touches the status icons", () => {
    for (const p of [flow, overlay]) {
      expect({ width, islandRight: Math.round(p.island.r), iconsLeft: Math.round(p.icons.l) }).toMatchObject({
        islandRight: expect.any(Number),
      });
      expect(p.island.r).toBeLessThan(p.icons.l);
    }
  });

  it("leaves real breathing room, not a one-pixel miss", () => {
    // 6px at the narrowest phone. Anything tighter reads as a collision even
    // when the boxes technically clear.
    expect(flow.island.l - flow.time.r).toBeGreaterThanOrEqual(6);
    expect(flow.icons.l - flow.island.r).toBeGreaterThanOrEqual(6);
  });

  it("the clock and the icons sit level with the Island", () => {
    const islandMid = (flow.island.t + flow.island.b) / 2;
    for (const el of [flow.time, flow.icons]) {
      expect(Math.abs((el.t + el.b) / 2 - islandMid)).toBeLessThanOrEqual(3.5);
    }
  });

  it("screen width matches the exported helper the callers size against", () => {
    expect(Math.abs(flow.screen.w - phoneScreenWidth(width))).toBeLessThanOrEqual(0.6);
  });

  // Apple's real numbers. A frame that drifts off these stops reading as an
  // iPhone and starts reading as a drawing of one — the 38px corner radius the
  // hero used on a 280px phone (43 is correct) was most of why it looked fake.
  it("keeps the real iPhone proportions", () => {
    expect(flow.body.radius / width).toBeCloseTo(0.155, 2);
    expect(flow.island.w / flow.screen.w).toBeCloseTo(0.318, 2);
    expect(flow.island.h / flow.screen.w).toBeCloseTo(0.094, 2);
  });

  it("the screen's corners nest inside the body's", () => {
    expect(flow.screen.radius).toBeLessThan(flow.body.radius);
    expect(flow.screen.w).toBeLessThan(flow.body.w);
  });

  it("has a home indicator, centred and inside the screen", () => {
    expect(flow.indicator).not.toBeNull();
    expect(Math.abs(flow.indicator!.cx - flow.indicator!.screenCx)).toBeLessThanOrEqual(1);
    expect(flow.indicator!.bottomGap).toBeGreaterThan(0);
    expect(flow.indicator!.w / flow.screen.w).toBeCloseTo(0.354, 2);
  });

  it("has all four side buttons", () => {
    expect(flow.buttons).toBe(4);
  });
});
