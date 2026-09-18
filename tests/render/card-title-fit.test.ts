import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "playwright";
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

// THE JOB TITLE AND THE COMPANY NAME USE THE ROOM THEY HAVE.
//
// Both were sized from a fixed base, so a short title sat at 8–9.5px on a 460px
// card with a column three times wider than it needed — "my title, which says
// CEO, is tiny. You can't even read it" (owner, 2026-09-17). They are now sized
// from the column itself (fitTitleFluid / fitCompany's grow), and this measures
// the result in a real browser: big enough to read when short, still inside the
// card when long.

const BASE: CardData = {
  name: "Alex Morgan", title: "CEO", company: "Coastline Realty",
  phone: "(415) 555-0188", email: "alex@coastlinerealty.com", website: "coastlinehomes.com",
  initials: "AM", cardUrl: "swiftcard.me/alexmorgan",
};
const TEMPLATES: Array<[string, React.ComponentType<{ data: CardData }>]> = [
  ["classic-pro", ClassicPro], ["modern-bold", ModernBold], ["photo-first", PhotoFirst],
  ["local-business", LocalBusiness], ["luxury-minimal", LuxuryMinimal], ["logo-first", LogoFirst],
];
const LONG_TITLE = "Senior Vice President, Commercial Leasing";
const ADDR = "1200 Ocean Ave, Suite 400\nSan Francisco, CA 94122";

let browser: Browser;
beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
afterAll(async () => { await browser?.close(); });

async function measure(T: React.ComponentType<{ data: CardData }>, data: CardData, text: string) {
  const css = await appCss();
  const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>` +
      `<body style="margin:0"><div class="sc-card" id="card" style="width:460px">${renderToStaticMarkup(createElement(T, { data }))}</div></body></html>`,
      { waitUntil: "load" },
    );
    await page.waitForTimeout(150);
    return await page.evaluate((t) => {
      const el = Array.from(document.querySelectorAll("p, span, h3")).find(
        (e) => (e.textContent || "").trim().toUpperCase() === t.toUpperCase(),
      );
      if (!el) return null;
      const card = document.getElementById("card")!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return {
        px: parseFloat(getComputedStyle(el).fontSize),
        overflowRight: Math.round(r.right - card.right),
        overflowBottom: Math.round(r.bottom - card.bottom),
      };
    }, text);
  } finally {
    await page.close();
  }
}

describe("a short job title is readable on every template", () => {
  for (const [name, T] of TEMPLATES) {
    it(`${name} renders "CEO" large enough to read`, async () => {
      const m = await measure(T, BASE, "CEO");
      expect(m, `${name}: no title element found`).not.toBeNull();
      // The old fixed bases were 8–9.5px. 12 is the line between "small print"
      // and "can't read it" at this card size.
      expect(m!.px, `${name}: "CEO" rendered at ${m!.px}px`).toBeGreaterThanOrEqual(12);
      expect(m!.overflowRight, `${name}: title runs off the card`).toBeLessThanOrEqual(0);
    }, 60_000);
  }
});

describe("a long job title still fits the card", () => {
  for (const [name, T] of TEMPLATES) {
    it(`${name} keeps a 41-character title inside a busy card`, async () => {
      const data: CardData = { ...BASE, title: LONG_TITLE, address: ADDR, customization: { fax: "(415) 555-0100" } };
      const m = await measure(T, data, LONG_TITLE);
      expect(m, `${name}: no title element found`).not.toBeNull();
      expect(m!.overflowRight, `${name}: long title runs off the side`).toBeLessThanOrEqual(0);
      expect(m!.overflowBottom, `${name}: long title runs off the bottom`).toBeLessThanOrEqual(0);
      // Never shrunk into a smudge either.
      expect(m!.px, `${name}: long title rendered at ${m!.px}px`).toBeGreaterThanOrEqual(6.5);
    }, 60_000);
  }
});

describe("a short company name uses the space beside the logo", () => {
  for (const [name, T] of TEMPLATES) {
    it(`${name} grows "Remax" past its design size`, async () => {
      const m = await measure(T, { ...BASE, company: "Remax" }, "Remax");
      expect(m, `${name}: no company element found`).not.toBeNull();
      expect(m!.px, `${name}: "Remax" rendered at ${m!.px}px`).toBeGreaterThanOrEqual(11);
      expect(m!.overflowRight, `${name}: company runs off the card`).toBeLessThanOrEqual(0);
    }, 60_000);
  }
});
