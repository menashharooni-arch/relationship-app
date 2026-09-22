import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser, Page } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { launchBrowser, appCss } from "./harness";

import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import LogoFirst from "@/components/card-templates/LogoFirst";
import type { CardData } from "@/components/card-templates/types";

// ── The details block USES the space it has ─────────────────────────────────
//
// Owner, 2026-09-22: "card detail information … has to fit the space and
// maximize it as much as it could … I just created a card and the information
// looks so small on the card."
//
// card-fit-sweep proves nothing is cut off. It could not see this, because a
// card with tiny text and half its panel empty fits perfectly. Before the fix
// a fresh card — phone, email, website, address — drew its phone at 14.5px on
// every template while 18–25px fitted, because the size came from a row-count
// curve that stopped growing at 4.5 rows.
//
// So this measures the other half: the block is FULL when its rows fill its
// height, or a row spans its width, or the lead row has reached the design
// ceiling (the phone never outgrows the person's name). One of the three must
// be true on every card.

const TEMPLATES: Array<[string, React.ComponentType<{ data: CardData }>]> = [
  ["classic-pro", ClassicPro],
  ["modern-bold", ModernBold],
  ["photo-first", PhotoFirst],
  ["local-business", LocalBusiness],
  ["luxury-minimal", LuxuryMinimal],
  ["logo-first", LogoFirst],
];

const FONTS: Array<[string, string | undefined]> = [
  ["default", undefined],
  ["serif", "Georgia, 'Times New Roman', serif"],
  ["mono", "'Courier New', ui-monospace, monospace"],
];

const BASE: CardData = {
  name: "Alex Morgan",
  title: "Realtor",
  company: "Coastline Realty",
  phone: "(415) 555-0188",
  email: "alex@coastlinerealty.com",
  website: "coastlinehomes.com",
  initials: "AM",
  photoUrl: null,
  logoUrl: null,
  cardUrl: "swiftcard.me/card/alexmorgan",
};
const ph = (number: string, label: string) => ({ number, label, showOnCard: true });

const SCENARIOS: Array<[string, CardData]> = [
  ["phone only", { ...BASE, email: "", website: "" }],
  ["email only", { ...BASE, phone: "", website: "" }],
  ["a fresh card", BASE],
  ["a fresh card + address", { ...BASE, address: "1200 Ocean Ave, Suite 400\nSan Francisco, CA 94122" }],
  ["a fresh card + logo and photo", { ...BASE, logoUrl: "/demo/avatar.svg", photoUrl: "/demo/avatar.svg" }],
  ["two labelled phones", { ...BASE, customization: { phones: [ph("(415) 555-0188", "mobile"), ph("(415) 555-0199", "office")] } }],
  ["four labelled phones + fax", { ...BASE, customization: { fax: "(415) 555-0100", phones: [
    ph("(415) 555-0188", "mobile"), ph("(415) 555-0199", "office"), ph("(415) 555-0177", "direct"), ph("(415) 555-0166", "home")] } }],
  ["everything", { ...BASE, address: "1200 Ocean Avenue, Suite 400\nBuilding C, North Tower\nSan Francisco, CA 94122",
    logoUrl: "/demo/avatar.svg", photoUrl: "/demo/avatar.svg",
    customization: { fax: "(415) 555-0100", phones: [ph("(415) 555-0188", "mobile"), ph("(415) 555-0199", "office")] } }],
];

const WIDTH = 460;
/** DETAIL_MAX_PX in shared.tsx — a lead row at the ceiling is full by design. */
const CEILING_PX = 24;

async function measure(page: Page, css: string, Template: React.ComponentType<{ data: CardData }>, data: CardData) {
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
     <style>body{margin:0;padding:20px;background:#fff}#h{width:${WIDTH}px}</style></head>
     <body class="sc-app"><div id="h">${renderToStaticMarkup(createElement(Template, { data }))}</div></body></html>`,
    { waitUntil: "load" },
  );
  return page.evaluate(() => {
    const block = document.querySelector("[data-contact-block]") as HTMLElement;
    const inner = block.firstElementChild as HTMLElement;
    const b = block.getBoundingClientRect();
    let widest = 0;
    let lead = 0;
    for (const row of Array.from(inner.children) as HTMLElement[]) {
      const r = document.createRange();
      r.selectNodeContents(row);
      widest = Math.max(widest, r.getBoundingClientRect().right - b.left);
      const text = row.querySelector("span:last-child") as HTMLElement | null;
      if (text) lead = Math.max(lead, parseFloat(getComputedStyle(text).fontSize));
    }
    const tel = inner.querySelector('a[href^="tel:"] > span:last-child') as HTMLElement | null;
    return {
      height: inner.getBoundingClientRect().height / b.height,
      width: widest / b.width,
      lead,
      phonePx: tel ? parseFloat(getComputedStyle(tel).fontSize) : 0,
    };
  });
}

describe("the card's details fill the space they are given", () => {
  let browser: Browser;
  let page: Page;
  let css: string;
  beforeAll(async () => {
    browser = await launchBrowser();
    css = await appCss();
    page = await browser.newPage({ viewportSize: { width: WIDTH + 80, height: 900 } });
  }, 180_000);
  afterAll(async () => { await browser?.close(); });

  for (const [tname, Template] of TEMPLATES) {
    it(`${tname}: the block is full — by height, by width, or at the ceiling`, async () => {
      const thin: string[] = [];
      for (const [fname, fontFamily] of FONTS) {
        for (const [sname, d] of SCENARIOS) {
          const data = fontFamily ? { ...d, customization: { ...(d.customization ?? {}), fontFamily } } : d;
          const m = await measure(page, css, Template, data);
          // 0.8, not 1: the width estimates are per-typeface averages, so a row
          // in a wide face stops a little short of the edge by design.
          const full = m.height >= 0.8 || m.width >= 0.8 || m.lead >= CEILING_PX - 0.1;
          if (!full) thin.push(`[${fname}] ${sname}: ${Math.round(m.height * 100)}% tall, ${Math.round(m.width * 100)}% wide, lead ${m.lead.toFixed(1)}px`);
        }
      }
      expect(thin, `${tname} leaves room unused:\n  ${thin.join("\n  ")}`).toEqual([]);
    }, 120_000);
  }

  it("a fresh card's phone reads large on every template — it was 14.5px on all six", async () => {
    const fresh = SCENARIOS.find(([n]) => n === "a fresh card + address")![1];
    const plain = SCENARIOS.find(([n]) => n === "a fresh card")![1];
    for (const [tname, Template] of TEMPLATES) {
      expect((await measure(page, css, Template, fresh)).phonePx, `${tname} + address`).toBeGreaterThanOrEqual(16);
      expect((await measure(page, css, Template, plain)).phonePx, `${tname}`).toBeGreaterThanOrEqual(21);
    }
  }, 120_000);
});
