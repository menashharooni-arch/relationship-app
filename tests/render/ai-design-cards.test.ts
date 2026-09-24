import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "esbuild";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Browser } from "playwright";
import { appCss, launchBrowser } from "./harness";

// ── Every AI design, drawn for real and measured ────────────────────────────
// tests/ai-card-design.test.ts holds the engine to an ESTIMATE of text width.
// This draws every composition through CustomCard — the component the public
// card page renders — with the app's real fonts in Chromium, at a phone's card
// width and a desktop's, and measures the actual boxes: nothing may leave the
// card, and no line, picture or QR may sit on another.

let browser: Browser; let bundle: string; let tmp: string;

beforeAll(async () => {
  browser = await launchBrowser();
  const cache = resolve("node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  tmp = mkdtempSync(join(cache, "aicards-"));
  writeFileSync(join(tmp, "entry.tsx"), `
    import { createRoot } from "react-dom/client";
    import { createElement as h } from "react";
    import CustomCard from "@/components/card-templates/CustomCard";
    import CardScaler from "@/components/CardScaler";
    import { COMPOSITIONS, buildDesign, fallbackSpec } from "@/lib/ai-card-design";

    const PHOTO = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#888"/></svg>');
    const people = {
      typical: { name: "Dana Whitfield", title: "Insurance Advisor", company: "Beacon Mutual", phone: "(303) 555-0149", email: "dana@beaconmutual.com", website: "beaconmutual.com", address: "" },
      long: { name: "Christopher Fairweather-Blenkinsop", title: "Senior Vice President of Commercial Lending", company: "Northwestern Mutual Financial Partners", phone: "(215) 555-0199", email: "christopher.fairweather@northwesternmutual.com", website: "northwesternmutualfinancial.com", address: "" },
    };
    const cards: any[] = [];
    for (const comp of COMPOSITIONS) {
      for (const [who, p] of Object.entries(people)) {
        for (const [hs, lg] of [[false, false], [true, true]]) {
          const brief = { theme: "modern", colors: ["#1e3a8a"], headshot: hs, logo: lg, variant: 0 };
          const layout = buildDesign({ ...fallbackSpec(brief), composition: comp }, { ...p, hasPhoto: true, hasLogo: true }, brief);
          cards.push({ key: comp + "|" + who + "|" + hs, data: { ...p, initials: "DW", photoUrl: PHOTO, logoUrl: PHOTO, cardUrl: "swiftcard.me/x", customization: { customLayout: layout } } });
        }
      }
    }
    (window as any).render = (width: number) => {
      createRoot(document.getElementById("root")!).render(
        h("div", null, cards.map((c) => h("div", { key: c.key, "data-card": c.key, style: { width, marginBottom: 12 } }, h(CardScaler, null, h(CustomCard, { data: c.data })))))
      );
    };
  `);
  const out = await build({
    entryPoints: [join(tmp, "entry.tsx")], bundle: true, write: false, format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_APP_URL": '"https://swiftcard.me"' },
    alias: { "@": resolve("src") },
  });
  bundle = out.outputFiles[0].text;
}, 240_000);
afterAll(async () => { await browser?.close(); rmSync(tmp, { recursive: true, force: true }); });

for (const width of [340, 560]) {
  describe(`every composition at a ${width}px card`, () => {
    it("keeps every line, picture and QR on the card and off each other", async () => {
      const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
      await page.setContent(`<style>${await appCss()}</style><body style="margin:0;padding:10px;background:#fff"><div id="root"></div></body>`);
      await page.addScriptTag({ content: bundle });
      await page.evaluate((w) => (window as never as { render: (w: number) => void }).render(w), width);
      await page.waitForTimeout(800);
      const problems = await page.evaluate(() => {
        const out: string[] = [];
        let measured = 0;
        for (const holder of Array.from(document.querySelectorAll("[data-card]"))) {
          const key = holder.getAttribute("data-card");
          const card = holder.querySelector(".sc-card") as HTMLElement;
          const cr = card.getBoundingClientRect();
          const items = Array.from(card.querySelectorAll("[data-el]"))
            .map((el) => {
              // The CONTENT's box, not the wrapper's: shapes are decoration and skipped.
              const inner = el.firstElementChild as HTMLElement | null;
              if (!inner || el.querySelector("div[style*='width: 100%'][style*='height: 100%']") === inner) return null;
              const r = inner.getBoundingClientRect();
              return { id: el.getAttribute("data-el")!, l: r.left, t: r.top, r: r.right, b: r.bottom };
            })
            .filter((x): x is { id: string; l: number; t: number; r: number; b: number } => !!x && x.r - x.l > 0);
          measured += items.length;
          // Every picture draws at its full, square size — a right-anchored
          // photo once rendered as a sliver and still passed the bounds check.
          for (const img of Array.from(card.querySelectorAll("[data-el] img")) as HTMLImageElement[]) {
            const r = img.getBoundingClientRect();
            if (Math.abs(r.width - r.height) > 1.5 || r.width < 12) out.push(`${key}: picture drawn ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
          }
          for (const it of items) {
            if (it.l < cr.left - 1 || it.r > cr.right + 1 || it.t < cr.top - 1 || it.b > cr.bottom + 1) out.push(`${key}: ${it.id} leaves the card`);
          }
          for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
            const a = items[i], b = items[j];
            if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) out.push(`${key}: ${a.id} overlaps ${b.id}`);
          }
        }
        return { out, measured, cards: document.querySelectorAll("[data-card]").length };
      });
      // 9 compositions × 2 people × 2 image choices, each with several lines, pictures and a QR.
      expect(problems.cards).toBe(36);
      expect(problems.measured).toBeGreaterThan(36 * 5);
      expect(problems.out).toEqual([]);
      await page.close();
    });
  });
}
