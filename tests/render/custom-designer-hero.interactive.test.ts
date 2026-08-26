import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "esbuild";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Browser } from "playwright";
import { appCss, launchBrowser } from "./harness";

let browser: Browser; let bundle: string; let tmp: string;

beforeAll(async () => {
  browser = await launchBrowser();
  const cache = resolve("node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  tmp = mkdtempSync(join(cache, "designer-"));
  writeFileSync(join(tmp, "entry.tsx"), `
    import { createRoot } from "react-dom/client";
    import { createElement } from "react";
    import CustomCardDesigner from "@/components/CustomCardDesigner";
    import { normalizeCustomLayout } from "@/lib/custom-layout";
    const data = { name: "Menash Harooni", title: "Founder", company: "SwiftCard", phone: "555", email: "m@s.me", website: "swiftcard.me", initials: "MH", photoUrl: null, logoUrl: null, cardUrl: "swiftcard.me/x" };
    createRoot(document.getElementById("root")!).render(
      createElement(CustomCardDesigner, { layout: normalizeCustomLayout(null), data, onChange: () => {}, canScan: true })
    );
  `);
  const out = await build({
    entryPoints: [join(tmp, "entry.tsx")], bundle: true, write: false, format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: { "@": resolve("src") },
  });
  bundle = out.outputFiles[0].text;
});
afterAll(async () => { await browser?.close(); rmSync(tmp, { recursive: true, force: true }); });

describe("copy-design hero box", () => {
  it("renders at the top of Looks with the magic frame", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent(`<style>${await appCss()}</style><body class="bg-gray-950"><div id="root"></div></body>`);
    await page.addScriptTag({ content: bundle });
    await page.waitForSelector("text=Copy a card or template you like");
    const order = await page.evaluate(() => {
      const looksPanel = [...document.querySelectorAll("p")].find(p => p.textContent === "Looks")!.closest("div")!.parentElement!;
      const html = looksPanel.innerHTML;
      return { boxBeforeThumbs: html.indexOf("Copy a card") < html.indexOf("grid-cols-4"), hasFrame: !!document.querySelector(".sc-magic-frame"), hasHalo: !!document.querySelector(".sc-magic-halo") };
    });
    expect(order.boxBeforeThumbs).toBe(true);
    expect(order.hasFrame).toBe(true);
    expect(order.hasHalo).toBe(true);
    await page.screenshot({ path: "/Users/menashharooni/.playwright-mcp/designer-hero.png" });
    await page.close();
  });
});
