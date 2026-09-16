import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "esbuild";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Browser, Page } from "playwright";
import { appCss, launchBrowser } from "./harness";

// ─────────────────────────────────────────────────────────────────────────────
// THE CARD DESIGN TAB, MOUNTED AND USED.
//
// The 2026-09-16 restructure (Template gallery → Look → Fine-tune → More, a
// docked preview on phones, and the old-designer card left alone) is all
// behaviour: a thumbnail that only exists after CardScaler measures, a patch a
// tap produces, a dock that appears on scroll, an onChange that must NOT fire on
// mount. None of that is visible to a source scan or to static markup, so each
// piece is bundled and mounted for real in a touch-emulated phone viewport.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_TAP = 44;
const DATA = `{ name: "Alex Morgan", title: "Realtor", company: "Coastline Realty", phone: "(415) 555-0188", email: "alex@coastline.com", website: "coastline.com", initials: "AM", photoUrl: null, logoUrl: null, cardUrl: "swiftcard.me/alexmorgan" }`;

const ENTRIES: Record<string, string> = {
  picker: `
    import { createRoot } from "react-dom/client";
    import { createElement, useState } from "react";
    import TemplatePicker from "@/components/card-templates/TemplatePicker";
    const params = new URLSearchParams(location.hash.slice(1));
    function App() {
      const [t, setT] = useState(params.get("t") || "classic-pro");
      (window as any).__picked = t;
      return createElement(TemplatePicker, { template: t, onSelect: setT, data: ${DATA}, customUnlocked: params.get("unlocked") === "1" });
    }
    createRoot(document.getElementById("root")!).render(createElement(App));
  `,
  style: `
    import { createRoot } from "react-dom/client";
    import { createElement, useState } from "react";
    import TemplateStyleControls from "@/components/card-templates/TemplateStyleControls";
    const params = new URLSearchParams(location.hash.slice(1));
    const initial = JSON.parse(params.get("v") || "{}");
    function App() {
      const [v, setV] = useState(initial);
      (window as any).__value = v;
      return createElement(TemplateStyleControls, {
        value: v,
        onChange: (p: any) => { (window as any).__patches = [...((window as any).__patches || []), p]; setV((prev: any) => ({ ...prev, ...p })); },
        template: "classic-pro",
        locked: params.get("locked") === "1",
      });
    }
    createRoot(document.getElementById("root")!).render(createElement(App));
  `,
  legacy: `
    import { createRoot } from "react-dom/client";
    import { createElement, useState } from "react";
    import CustomCardDesigner from "@/components/CustomCardDesigner";
    const legacy = {
      background: "#0e1b35", fontFamily: "Georgia, serif", textColor: "#ffffff",
      elements: [
        { id: "n", type: "field", field: "name", x: 8, y: 20, fontSize: 22, bold: true },
        { id: "t", type: "field", field: "title", x: 8, y: 40, fontSize: 12 },
        { id: "q", type: "qr", x: 75, y: 55, size: 80 },
      ],
    };
    (window as any).__calls = 0;
    function App() {
      const [layout, setLayout] = useState<any>(legacy);
      return createElement(CustomCardDesigner, {
        layout, data: ${DATA},
        onChange: (l: any) => { (window as any).__calls++; (window as any).__last = l; setLayout(l); },
        canScan: true,
      });
    }
    createRoot(document.getElementById("root")!).render(createElement(App));
  `,
  dock: `
    import { createRoot } from "react-dom/client";
    import { createElement } from "react";
    import DockedCardPreview from "@/components/DockedCardPreview";
    import ClassicPro from "@/components/card-templates/ClassicPro";
    const card = createElement(ClassicPro, { data: ${DATA} });
    createRoot(document.getElementById("root")!).render(
      createElement("div", null,
        createElement("div", { style: { height: 200 } }),
        createElement("div", { id: "design-inline-preview", style: { height: 220 } }, "inline preview"),
        createElement("div", { style: { height: 3000 } }),
        createElement(DockedCardPreview, { anchorId: "design-inline-preview" }, card),
      )
    );
  `,
};

let browser: Browser;
let tmp: string;
const bundles: Record<string, string> = {};

beforeAll(async () => {
  browser = await launchBrowser();
  const cache = resolve("node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  tmp = mkdtempSync(join(cache, "card-design-tab-"));
  for (const [name, src] of Object.entries(ENTRIES)) {
    writeFileSync(join(tmp, `${name}.tsx`), src);
    const out = await build({
      entryPoints: [join(tmp, `${name}.tsx`)], bundle: true, write: false, format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' },
      alias: { "@": resolve("src") },
      loader: { ".svg": "text" },
      // PlanGate and friends read NEXT_PUBLIC_* at runtime; there is no Next here.
      banner: { js: "var process = { env: { NODE_ENV: \"production\" } };" },
    });
    bundles[name] = out.outputFiles[0].text;
  }
}, 180_000);
afterAll(async () => { await browser?.close(); if (tmp) rmSync(tmp, { recursive: true, force: true }); });

async function mount(name: string, hash = "", width = 390, height = 844): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`about:blank#${hash}`);
  await page.setContent(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${await appCss()}</style>
     <style>body{margin:0;padding:12px;background:#0b0f16}</style></head>
     <body class="sc-app"><div id="root"></div></body></html>`,
  );
  // setContent keeps the about:blank URL, so the hash set above survives.
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.addScriptTag({ content: bundles[name] });
  await page.waitForTimeout(400);
  return page;
}

describe("template gallery", () => {
  it("shows seven real options, each a proper thumb target", async () => {
    const page = await mount("picker", "unlocked=1");
    const tiles = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")].map((b) => {
        const r = b.getBoundingClientRect();
        return { label: b.getAttribute("aria-label"), h: Math.round(r.height), w: Math.round(r.width), pressed: b.getAttribute("aria-pressed") };
      }),
    );
    expect(tiles.map((t) => t.label)).toEqual([
      "Classic Pro", "Modern Bold", "Photo First", "Local Business", "Luxury Minimal", "Logo First", "Custom design",
    ]);
    for (const t of tiles) expect(t.h, `${t.label} is ${t.h}px tall`).toBeGreaterThanOrEqual(MIN_TAP);
    expect(tiles.filter((t) => t.pressed === "true").map((t) => t.label)).toEqual(["Classic Pro"]);
    await page.context().close();
  });

  it("draws every template for real — no collapsed thumbnails", async () => {
    const page = await mount("picker", "unlocked=1");
    const widths = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-preview-locked='true']")].map((el) => Math.round(el.getBoundingClientRect().height)),
    );
    expect(widths).toHaveLength(6);
    for (const h of widths) expect(h).toBeGreaterThan(40);
    await page.context().close();
  });

  it("selects on tap, and never nests the card's links inside the button", async () => {
    const page = await mount("picker", "unlocked=1");
    await page.click("button[aria-label='Modern Bold']");
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => (window as unknown as { __picked: string }).__picked)).toBe("modern-bold");
    expect(await page.evaluate(() => document.querySelectorAll("button a, button [href]").length)).toBe(0);
    await page.context().close();
  });

  it("locks Custom without Pro, and says so", async () => {
    const page = await mount("picker", "unlocked=0");
    const custom = await page.$("button[aria-label='Custom design']");
    expect(await custom!.isDisabled()).toBe(true);
    expect(await page.textContent("body")).toContain("unlock the custom designer with Pro");
    await page.context().close();
  });
});

describe("style panel: Look → Fine-tune → More", () => {
  it("an untouched card shows Original selected", async () => {
    const page = await mount("style", "v={}");
    const pressed = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLButtonElement>("button[aria-pressed='true']")].map((b) => (b.textContent || "").trim()),
    );
    expect(pressed.some((t) => t.includes("Original"))).toBe(true);
    await page.context().close();
  });

  it("Original hands back exactly the keys a Look sets — nothing else", async () => {
    const v = encodeURIComponent(JSON.stringify({ bgColor: "#052e2b", textColor: "#ffffff", finish: "sheen", accentColor: "#be123c", infoColor: "#111827" }));
    const page = await mount("style", `v=${v}`);
    await page.click("button[title=\"The template's own colours, font and finish\"]");
    await page.waitForTimeout(80);
    const { patches, value } = await page.evaluate(() => ({
      patches: (window as unknown as { __patches: Record<string, unknown>[] }).__patches,
      value: (window as unknown as { __value: Record<string, unknown> }).__value,
    }));
    expect(Object.keys(patches.at(-1)!).sort()).toEqual(["bgColor", "finish", "fontFamily", "surfaceColor", "textColor"]);
    expect(Object.values(patches.at(-1)!).every((x) => x === undefined)).toBe(true);
    // Accent and details colour are not part of a Look, so Original leaves them.
    expect(value.accentColor).toBe("#be123c");
    expect(value.infoColor).toBe("#111827");
    await page.context().close();
  });

  it("Fine-tune shows one group at a time, and every control in each clears 44px", async () => {
    const page = await mount("style", "v={}");
    for (const seg of ["Colours", "Font", "Finish"]) {
      await page.click(`[role='group'][aria-label='Fine-tune'] button:has-text('${seg}')`);
      await page.waitForTimeout(80);
      const small = await page.evaluate((min) =>
        [...document.querySelectorAll<HTMLElement>("button, summary, input[type='color']")]
          .map((el) => ({ t: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24), h: Math.round(el.getBoundingClientRect().height), w: el.getBoundingClientRect().width }))
          .filter((r) => r.w > 0 && r.h > 0 && r.h < min), MIN_TAP);
      expect(small, `${seg}: ${JSON.stringify(small)}`).toEqual([]);
    }
    const visible = await page.evaluate(() => ({
      finishTiles: [...document.querySelectorAll<HTMLElement>("button[title*='·']")].filter((b) => b.getBoundingClientRect().width > 0).length,
      fontPills: [...document.querySelectorAll<HTMLElement>("button")].filter((b) => (b.textContent || "").includes("Ag") && b.getBoundingClientRect().width > 0).length,
    }));
    expect(visible.finishTiles).toBe(8);
    expect(visible.fontPills, "font pills leak into the Finish group").toBe(0);
    await page.context().close();
  });

  it("accent is a Colours control now, not buried under More", async () => {
    const page = await mount("style", "v={}");
    const accentVisible = await page.evaluate(() =>
      [...document.querySelectorAll("p")].some((p) => p.textContent === "Accent / icons" && p.getBoundingClientRect().width > 0),
    );
    expect(accentVisible).toBe(true);
    await page.context().close();
  });

  it("flags a Pro colour hidden behind a closed segment on a Free account", async () => {
    const v = encodeURIComponent(JSON.stringify({ bgColor: "#123456" }));
    const page = await mount("style", `v=${v}&locked=1`);
    expect(await page.$("[role='group'][aria-label='Fine-tune'] [aria-label='uses a Pro option']")).not.toBeNull();
    await page.context().close();
  });
});

describe("a card from the previous custom designer", () => {
  it("is shown as saved and NOT rewritten on mount", async () => {
    const page = await mount("legacy");
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as unknown as { __calls: number }).__calls)).toBe(0);
    expect(await page.textContent("body")).toContain("previous designer");
    await page.context().close();
  });

  it("converts only when its owner asks", async () => {
    const page = await mount("legacy");
    await page.click("button:has-text('Convert to edit')");
    await page.waitForTimeout(200);
    const last = await page.evaluate(() => (window as unknown as { __last: { blocks?: unknown[]; elements?: unknown[]; background?: string } }).__last);
    expect(last.blocks?.length).toBeGreaterThan(0);
    expect(last.elements).toEqual([]);
    expect(last.background, "conversion kept the card's colour").toBe("#0e1b35");
    await page.context().close();
  });
});

describe("docked preview on a phone", () => {
  it("is absent at rest, appears once the inline preview scrolls away, and goes when it returns", async () => {
    const page = await mount("dock");
    const docked = () => page.evaluate(() => !!document.querySelector(".fixed [data-preview-locked='true']"));
    expect(await docked()).toBe(false);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(250);
    expect(await docked()).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    expect(await docked()).toBe(false);
    await page.context().close();
  });

  it("never appears on desktop, where the preview column is already pinned", async () => {
    const page = await mount("dock", "", 1280, 900);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => !!document.querySelector(".fixed [data-preview-locked='true']"))).toBe(false);
    await page.context().close();
  });
});
