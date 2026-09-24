import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "esbuild";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Browser, Page } from "playwright";
import { appCss, launchBrowser } from "./harness";

// ─────────────────────────────────────────────────────────────────────────────
// UNDO ON THE DESIGN TABS, USED FOR REAL.
//
// Owner, 2026-09-23: change the accent colour, don't like it, press Undo — it
// goes back, and the OTHER changes stay. Press again and the change before
// goes back. Nothing after Save. The real history (lib/use-design-history),
// the real buttons (UndoDesignButton) and the real pinned previews, mounted
// in Chromium at phone width and pressed.
// ─────────────────────────────────────────────────────────────────────────────

const DATA = `{ name: "Alex Morgan", title: "Realtor", company: "Coastline Realty", phone: "(415) 555-0188", email: "alex@coastline.com", website: "coastline.com", initials: "AM", photoUrl: null, logoUrl: null, cardUrl: "swiftcard.me/alexmorgan" }`;

const ENTRIES: Record<string, string> = {
  card: `
    import { createRoot } from "react-dom/client";
    import { createElement as h, useState } from "react";
    import PinnedCardPreview from "@/components/PinnedCardPreview";
    import UndoDesignButton from "@/components/UndoDesignButton";
    import ClassicPro from "@/components/card-templates/ClassicPro";
    import { useDesignHistory } from "@/lib/use-design-history";
    function App() {
      const [style, setStyle] = useState<any>({ accentColor: "#111111", fontFamily: "sans" });
      const [template, setTemplate] = useState("classic-pro");
      const hist = useDesignHistory({ template, style }, (s: any) => { setTemplate(s.template); setStyle(s.style); });
      const w = window as any;
      w.__state = { template, style };
      w.__set = (p: any) => setStyle((prev: any) => ({ ...prev, ...p }));
      w.__clear = hist.clear;
      return h("div", { style: { padding: "0 20px" } },
        h(PinnedCardPreview, { undo: hist }, h(ClassicPro, { data: ${DATA} })),
        h("div", { id: "desk" }, h(UndoDesignButton, { history: hist, variant: "pill" })),
        h("button", { id: "accent", onClick: () => setStyle((p: any) => ({ ...p, accentColor: "#ff0000" })) }, "accent"),
        h("button", { id: "font", onClick: () => setStyle((p: any) => ({ ...p, fontFamily: "serif" })) }, "font"),
        h("button", { id: "tpl", onClick: () => setTemplate("modern-bold") }, "template"),
        h("div", { style: { height: 3000 } }),
      );
    }
    // A change BEFORE anyone touches the page (a restored draft, a layout
    // upgraded on mount) is the starting point, not a step.
    const root = createRoot(document.getElementById("root")!);
    root.render(h(App));
    setTimeout(() => (window as any).__set({ accentColor: "#222222" }), 50);
  `,
  links: `
    import { createRoot } from "react-dom/client";
    import { createElement as h, useState } from "react";
    import { PinnedLinkPreview } from "@/components/PinnedCardPreview";
    import { useDesignHistory, changedKeys } from "@/lib/use-design-history";
    const keyOf = (l: any) => (l.kind ?? "link") + "|" + l.label + "|" + l.url;
    function App() {
      const [links, setLinks] = useState<any[]>([{ label: "Site", url: "https://a.example" }]);
      const hist = useDesignHistory(
        { links: links.map((l) => ({ k: keyOf(l), size: l.size })) },
        (s: any) => setLinks((cur) => cur.map((l) => { const was = s.links.find((x: any) => x.k === keyOf(l)); return was ? { ...l, size: was.size } : l; })),
        { describe: (a: any, b: any) => a.links.map((x: any) => x.k).join() === b.links.map((x: any) => x.k).join() ? changedKeys(a, b) : null },
      );
      (window as any).__links = links;
      return h("div", null,
        h(PinnedLinkPreview, { undo: hist }, h("div", { style: { height: 600, background: "#123" } }, "page")),
        h("button", { id: "big", onClick: () => setLinks((c) => c.map((l, i) => i === 0 ? { ...l, size: "featured" } : l)) }, "featured"),
        h("button", { id: "add", onClick: () => setLinks((c) => [...c, { label: "New", url: "https://b.example" }]) }, "add"),
      );
    }
    createRoot(document.getElementById("root")!).render(h(App));
  `,
};

let browser: Browser;
let tmp: string;
const bundles: Record<string, string> = {};

beforeAll(async () => {
  browser = await launchBrowser();
  const cache = resolve("node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  tmp = mkdtempSync(join(cache, "design-undo-"));
  for (const [name, src] of Object.entries(ENTRIES)) {
    writeFileSync(join(tmp, `${name}.tsx`), src);
    const out = await build({
      entryPoints: [join(tmp, `${name}.tsx`)], bundle: true, write: false, format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' },
      alias: { "@": resolve("src") },
      loader: { ".svg": "text" },
      banner: { js: "var process = { env: { NODE_ENV: \"production\" } };" },
    });
    bundles[name] = out.outputFiles[0].text;
  }
}, 180_000);
afterAll(async () => { await browser?.close(); if (tmp) rmSync(tmp, { recursive: true, force: true }); });

async function mount(name: string, width = 390): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.setContent(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${await appCss()}</style>
     <style>body{margin:0;background:#0b0f16}</style></head>
     <body class="sc-app"><div id="root"></div></body></html>`,
  );
  await page.addScriptTag({ content: bundles[name] });
  await page.waitForTimeout(400);
  return page;
}

const corner = (p: Page) => p.locator('button[aria-label="Undo last design change"]');
const state = (p: Page) => p.evaluate(() => (window as unknown as { __state: { template: string; style: Record<string, unknown> } }).__state);

describe("Card design Undo", () => {
  it("is not there until something was changed — a change made on load is the starting point", async () => {
    const page = await mount("card");
    expect(await corner(page).count()).toBe(0);
    expect((await state(page)).style.accentColor).toBe("#222222");
    expect(await page.locator("#desk button").evaluate((b) => getComputedStyle(b).opacity)).toBe("0");
  });

  it("steps back one change at a time, newest first, keeping the others", async () => {
    const page = await mount("card");
    await page.locator("#accent").tap();
    await page.waitForTimeout(600); // a separate decision, not one drag
    await page.locator("#font").tap();
    await page.waitForTimeout(600);
    await page.locator("#tpl").tap();
    expect(await corner(page).count()).toBe(1);

    await corner(page).tap();
    let s = await state(page);
    expect(s.template).toBe("classic-pro");           // the template went back…
    expect(s.style).toEqual({ accentColor: "#ff0000", fontFamily: "serif" }); // …the rest stayed

    await corner(page).tap();
    s = await state(page);
    expect(s.style).toEqual({ accentColor: "#ff0000", fontFamily: "sans" });

    await corner(page).tap();
    s = await state(page);
    expect(s.style).toEqual({ accentColor: "#222222", fontFamily: "sans" }); // back to how it opened
    expect(await corner(page).count()).toBe(0); // nothing left to undo
  });

  it("a drag (a burst of changes to one thing) is ONE step", async () => {
    const page = await mount("card");
    await page.locator("#font").tap(); // arm + a first step
    await page.waitForTimeout(600);
    await page.evaluate(async () => {
      for (let i = 0; i < 20; i++) { (window as unknown as { __set: (p: Record<string, unknown>) => void }).__set({ accentColor: "#0000" + String(i).padStart(2, "0") }); await new Promise((r) => setTimeout(r, 16)); }
    });
    await corner(page).tap();
    expect((await state(page)).style.accentColor).toBe("#222222"); // straight back to before the drag
    expect((await state(page)).style.fontFamily).toBe("serif");
  });

  it("Save ends the history", async () => {
    const page = await mount("card");
    await page.locator("#accent").tap();
    expect(await corner(page).count()).toBe(1);
    await page.evaluate(() => (window as unknown as { __clear: () => void }).__clear());
    await page.waitForTimeout(50);
    expect(await corner(page).count()).toBe(0);
  });

  it("the corner button sits on the pinned card's corner, clear of the full-size cue, a real tap target, on the smallest phone", async () => {
    const page = await mount("card", 320);
    await page.locator("#accent").tap();
    const r = await corner(page).evaluate((b) => { const x = b.getBoundingClientRect(); return { l: x.left, t: x.top, w: x.width, h: x.height }; });
    const cue = await page.locator('button[aria-label="See your card full size"] span[aria-hidden]').evaluate((b) => { const x = b.getBoundingClientRect(); return { l: x.left, r: x.right }; });
    expect(r.l).toBeGreaterThanOrEqual(0);
    expect(r.w).toBeGreaterThanOrEqual(32);
    expect(r.l + r.w).toBeLessThan(cue.l); // opposite corners, no overlap
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Pressing Undo is not also a tap on the card (which opens full size).
    await corner(page).tap();
    expect(await page.locator('[role="dialog"]').count()).toBe(0);
  });
});

describe("Social design Undo", () => {
  it("undoes a link's look, and never a link added on Socials", async () => {
    const page = await mount("links");
    await page.locator("#big").tap();
    await page.waitForTimeout(600);
    await page.locator("#add").tap(); // a different tab's change — not a step here
    const undo = page.getByRole("button", { name: "Undo" });
    await undo.tap();
    const links = await page.evaluate(() => (window as unknown as { __links: { size?: unknown }[] }).__links);
    expect(links).toHaveLength(2);           // the added link is still there
    expect(links[0].size).toBeUndefined();   // the tile size went back
  });
});
