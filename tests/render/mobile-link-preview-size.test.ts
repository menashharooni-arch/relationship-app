import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { launchBrowser, appCss } from "./harness";

import SwiftLinkLivePreview from "@/components/SwiftLinkLivePreview";

// ── The Swift Links preview must read as a mini-phone, not fill the screen ───
//
// SwiftLinkLivePreview renders the REAL profile at a 390px phone width and lets
// CardScaler shrink it into whatever slot it is given. In the editor's Social
// design tab that slot was the full form column, so on a 375px phone it scaled
// to ~0.88 — a "preview" nearly the size of the thing it previews, pushing every
// colour and font control below the fold. Capping the slot is the whole fix:
// the scale is slot ÷ 390, so the cap IS the size.
//
// Frame width is pure CSS, so static markup reproduces it exactly (same
// technique as swiftlink-preview-frame). What this pins is the number that
// feeds the scale.

const PREVIEW_PROPS = {
  name: "Alex Morgan",
  handle: "alex-morgan",
  company: "Morgan & Co.",
  bio: "Top realtor in Miami",
  socials: { instagram: "alexmorgan" },
  links: [{ label: "Leave a review", url: "https://example.com" }],
  paid: true,
} as const;

/** CardScaler's phone natural width — the divisor for every scale below. */
const NATURAL = 390;
/** The cap both surfaces apply: max-w-[220px] mx-auto. */
const CAP = "w-full max-w-[220px] mx-auto";

// A 375px phone (iPhone SE/12 mini — the narrowest we support) with the form
// column's real px-4 padding: 375 − 32 = 343px of usable width.
function phoneColumn(inner: string): string {
  return `<div style="width:375px" class="px-4"><div class="space-y-4">${inner}</div></div>`;
}

describe("the Swift Links preview is capped to a mini-phone on a 375px screen", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  async function measure(wrapperClass: string | null): Promise<{ frame: number; left: number; right: number; column: number }> {
    const css = await appCss();
    const markup = renderToStaticMarkup(createElement(SwiftLinkLivePreview, PREVIEW_PROPS));
    const slot = wrapperClass ? `<div class="${wrapperClass}">${markup}</div>` : markup;
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: 375, height: 900 });
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
         <style>body{margin:0;background:#0b0d14}</style>
         </head><body class="sc-app">${phoneColumn(slot)}</body></html>`,
        { waitUntil: "load" },
      );
      // Guard on the guard: a viewport that silently stayed at the default
      // would make every assertion below meaningless.
      expect(await page.evaluate(() => window.innerWidth)).toBe(375);
      return await page.evaluate(() => {
        const frame = document.querySelector("[data-preview-locked]") as HTMLElement;
        if (!frame) throw new Error("no preview frame in rendered output");
        const f = frame.getBoundingClientRect();
        const col = (document.querySelector(".space-y-4") as HTMLElement).getBoundingClientRect();
        return {
          frame: Math.round(f.width),
          left: Math.round(f.left - col.left),
          right: Math.round(col.right - f.right),
          column: Math.round(col.width),
        };
      });
    } finally {
      await page.close();
    }
  }

  it("uncapped, it very nearly fills the phone — the complaint", async () => {
    const { frame, column } = await measure(null);
    expect(column).toBe(343);
    expect(frame, "the uncapped preview no longer fills the column").toBeGreaterThan(300);
    // ~0.88 scale: a preview almost as big as the real page.
    expect(frame / NATURAL).toBeGreaterThan(0.85);
  }, 60_000);

  it("capped, it is 220px — a true mini-phone at ~0.56 scale", async () => {
    const { frame } = await measure(CAP);
    expect(frame).toBe(220);
    const scale = frame / NATURAL;
    expect(scale).toBeGreaterThan(0.5);
    expect(scale).toBeLessThan(0.6);
  }, 60_000);

  it("and it is centred, not hugging the left edge", async () => {
    const { left, right } = await measure(CAP);
    // mx-auto splits the leftover 123px evenly; 1px of rounding is fine.
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    expect(left).toBeGreaterThan(50);
  }, 60_000);

  it("the cap never collapses the frame — the failure mode this file guards", async () => {
    // max-w alone on a shrink-wrapping child would give 0. The w-full in the
    // cap class is what prevents it; drop it and this goes to 0, not to 220.
    const { frame } = await measure(CAP);
    expect(frame).toBeGreaterThan(0);
  }, 60_000);

  it("it still renders the real page's content at that size", async () => {
    // Smaller must mean scaled, not stripped: the bio, the social row and the
    // link button are exactly what the Socials step edits.
    const css = await appCss();
    const markup = renderToStaticMarkup(createElement(SwiftLinkLivePreview, PREVIEW_PROPS));
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: 375, height: 900 });
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
         <body class="sc-app">${phoneColumn(`<div class="${CAP}">${markup}</div>`)}</body></html>`,
        { waitUntil: "load" },
      );
      const text = await page.evaluate(() => document.body.innerText);
      expect(text).toContain("Alex Morgan");
      expect(text).toContain("Top realtor in Miami");
      expect(text).toContain("Leave a review");
    } finally {
      await page.close();
    }
  }, 60_000);
});
