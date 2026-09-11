// ── A sheet that is dark ON PURPOSE, inside the light-themed app ─────────────
//
// The owner photographed this on 2026-09-11: tapping Get Pro on a CRM row in
// the iOS shell opened a paywall you could see straight through — the settings
// page showing behind the perks, the price rows washed out, the heading dark
// on dark. Not a z-index bug. The light theme remaps .bg-gray-900 to WHITE and
// .text-white to near-black so app panels read on cream, and the paywall is
// built from exactly those classes.
//
// `.sc-dark-sheet` is the standing exemption. A source scan cannot prove it
// works — the answer is a cascade outcome — so this renders the real compiled
// CSS in a browser and reads the computed values back.
//
// It also pins the reverse: WITHOUT the class the same markup does go white,
// which is what makes the class load-bearing rather than decoration.

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { readFileSync } from "node:fs";
import { appCss } from "./harness";

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

const rgb = (s: string) => (s.match(/\d+/g) ?? []).slice(0, 3).map(Number);
const luminance = (s: string) => { const [r, g, b] = rgb(s); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

async function computed(markup: string, selector: string, prop: string) {
  const css = await appCss();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.setContent(
      `<!doctype html><html data-sc-theme="light"><head><meta charset="utf-8"><style>${css}</style></head>` +
        `<body class="sc-app" style="margin:0">${markup}</body></html>`,
      { waitUntil: "load" },
    );
    return await page.evaluate(([sel, p]) => getComputedStyle(document.querySelector(sel as string)!)[p as never] as string, [selector, prop]);
  } finally {
    await page.close();
  }
}

describe("the paywall stays dark in the light theme", () => {
  it("keeps its surface dark, its heading white and its fine print readable", async () => {
    const sheet = `<div class="sc-dark-sheet bg-gray-900" id="s">
        <p class="text-white" id="title">Go Pro</p>
        <p class="text-gray-300" id="perk">Unlimited cards</p>
        <p class="text-gray-500" id="fine">Free for your first 14 days</p>
        <div class="border-gray-800 bg-gray-900" id="row" style="border-width:1px"></div>
      </div>`;
    expect(luminance(await computed(sheet, "#s", "backgroundColor")), "sheet surface").toBeLessThan(0.25);
    expect(luminance(await computed(sheet, "#title", "color")), "heading ink").toBeGreaterThan(0.9);
    const perk = luminance(await computed(sheet, "#perk", "color"));
    expect(perk, "perk ink").toBeGreaterThan(0.6);
    expect(luminance(await computed(sheet, "#fine", "color")), "fine print").toBeGreaterThan(0.3);
    expect(luminance(await computed(sheet, "#row", "backgroundColor")), "plan row").toBeLessThan(0.25);
  });

  it("without the class the same markup really does go white — the exemption is load-bearing", async () => {
    const bare = `<div class="bg-gray-900" id="s"><p class="text-white" id="title">Go Pro</p></div>`;
    expect(luminance(await computed(bare, "#s", "backgroundColor"))).toBeGreaterThan(0.9);
    expect(luminance(await computed(bare, "#title", "color"))).toBeLessThan(0.4);
  });

  it("the paywall and every Pro button actually carry the class", () => {
    const paywall = readFileSync("src/components/NativePaywall.tsx", "utf8");
    // the sheet itself
    expect(paywall).toMatch(/className="sc-dark-sheet w-full max-w-sm overflow-hidden rounded-3xl border border-gray-800 bg-gray-900/);
    // the heading must not be black on the blue header
    expect(paywall).not.toMatch(/id="iap-paywall-title"[^>]*text-black/);
    expect(paywall).toMatch(/id="iap-paywall-title"[^>]*text-white/);
    // the aurora pill's white label
    expect(paywall).toMatch(/className="sc-dark-sheet inline-flex shrink-0 items-center gap-1 rounded-full/);
    // the single CRM offer card's button
    expect(readFileSync("src/components/IntegrationsSettings.tsx", "utf8"))
      .toMatch(/className="sc-dark-sheet inline-flex items-center gap-1\.5 rounded-full/);
  });
});

// Every button that paints the aurora gradient behind white text has the same
// exposure: the light theme would turn that label near-black on saturated
// blue. This walks the call sites rather than trusting memory.
describe("white ink on the aurora gradient", () => {
  it("every gradient button in the app carries the exemption", () => {
    const files = [
      "src/components/NativePaywall.tsx",
      "src/components/IntegrationsSettings.tsx",
      "src/components/WelcomePlan.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        if (!line.includes('background: "var(--rd-aurora)"')) return;
        // the className is on this line or the two above it
        const block = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
        if (!/text-white/.test(block)) return;
        expect(block, `${f}:${i + 1} paints the aurora behind white text without sc-dark-sheet`).toMatch(/sc-dark-sheet/);
      });
    }
  });
});
