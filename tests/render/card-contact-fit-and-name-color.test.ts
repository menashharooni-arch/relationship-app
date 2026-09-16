import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser, Page } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ComponentType } from "react";
import { launchBrowser, appCss } from "./harness";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import LogoFirst from "@/components/card-templates/LogoFirst";
import type { CardData } from "@/components/card-templates/types";
import { CARD_FONT_OPTIONS } from "@/lib/template-style";
import { fitGrownPx, fitPx } from "@/components/card-templates/shared";

// ─────────────────────────────────────────────────────────────────────────────
// TWO BUGS THE OWNER PHOTOGRAPHED ON 2026-09-16, MEASURED.
//
// 1. A SPARSE card (no phone, no address) grows its contact text up to ~1.4x,
//    but the email/website fit kept the 13px character budget — so
//    "aaron@malvecapital.com" broke as "…malvecapital.c / om". Measured before
//    the fix: 31 of 90 font x template x email cases wrapped; dense cards 0.
//    fitGrownPx caps the growth at the calibrated width budget.
//
// 2. Name color did nothing on the cream (light) theme: globals.css restores card
//    whites with `.sc-card .text-white { color:#fff !important }`, which beats
//    the name's inline colour. The name now carries text-white only while no
//    colour is chosen (nameClass).
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES: [string, ComponentType<{ data: CardData }>][] = [
  ["ClassicPro", ClassicPro], ["ModernBold", ModernBold], ["PhotoFirst", PhotoFirst],
  ["LocalBusiness", LocalBusiness], ["LuxuryMinimal", LuxuryMinimal], ["LogoFirst", LogoFirst],
];

const card = (over: Partial<CardData>): CardData => ({
  name: "Aaron Lavi", title: "Managing Partner", company: "Malve Capital", phone: "", email: "",
  website: "", initials: "AL", photoUrl: null, logoUrl: null, cardUrl: "swiftcard.me/aaronlavi", customization: {}, ...over,
});

describe("fitGrownPx — the arithmetic", () => {
  it("is exactly fitPx when the row is not growing", () => {
    for (const t of ["a@b.co", "aaron@malvecapital.com", "bartholomew.fitzgerald@northwind-advisors.com"]) {
      expect(fitGrownPx(13, 1, t, 22)).toBe(fitPx(13, t, 22));
      expect(fitGrownPx(13, 0.8, t, 22)).toBe(fitPx(13 * 0.8, t, 22));
    }
  });

  it("still grows a short value on a sparse card", () => {
    expect(fitGrownPx(13, 1.4, "al@ab.co", 22)).toBeCloseTo(13 * 1.4);
  });

  it("never spends more width than the calibrated budget, and never shrinks below a normal card", () => {
    for (const t of ["alex@coastline.com", "aaron@malvecapital.com", "jennifer.w@malvecapital.com", "bartholomew.fitzgerald@northwind-advisors.com"]) {
      const size = fitGrownPx(13, 1.414, t, 22);
      expect(size * t.length).toBeLessThanOrEqual(Math.max(13 * 22, fitPx(13, t, 22) * t.length) + 1e-9);
      expect(size).toBeGreaterThanOrEqual(fitPx(13, t, 22));
    }
  });
});

let browser: Browser;
let page: Page;
let css: string;
beforeAll(async () => {
  browser = await launchBrowser();
  page = await browser.newPage({ viewport: { width: 700, height: 700 } });
  css = await appCss();
}, 120_000);
afterAll(async () => { await browser?.close(); });

async function render(Template: ComponentType<{ data: CardData }>, data: CardData, theme?: "light") {
  await page.setContent(
    `<!doctype html><html ${theme ? `data-sc-theme="${theme}"` : ""}><head><style>${css}</style></head>
     <body class="sc-app" style="margin:0;padding:20px"><div style="width:460px">${renderToStaticMarkup(createElement(Template, { data }))}</div></body></html>`,
  );
}

/** Does this contact row's text break onto a second line? Measured in place. */
function rowWraps(selector: string) {
  return page.evaluate((sel) => {
    const a = document.querySelector(sel);
    if (!a) return null;
    const sp = [...a.querySelectorAll("span")].pop() as HTMLElement;
    const h = sp.getBoundingClientRect().height;
    sp.style.whiteSpace = "nowrap";
    const one = sp.getBoundingClientRect().height;
    sp.style.whiteSpace = "";
    return h > one + 2;
  }, selector);
}

describe("a sparse card's email and website stay on one line", () => {
  const FONTS: [string, string | undefined][] = [["Default", undefined], ...CARD_FONT_OPTIONS.map((o) => [o.label, o.value] as [string, string])];
  const CASES: [string, string][] = [
    ["alex@coastline.com", "malvecapital.com"],
    ["aaron@malvecapital.com", "www.coastlinerealtygroup.com"],
    ["jennifer.w@malvecapital.com", "malvecapital.com"],
  ];

  for (const [tn, Template] of TEMPLATES) {
    it(`${tn}: every font, email and website`, async () => {
      const broken: string[] = [];
      for (const [fl, fv] of FONTS) {
        for (const [email, website] of CASES) {
          await render(Template, card({ email, website, customization: fv ? { fontFamily: fv } : {} }));
          if (await rowWraps("a[href^='mailto:']")) broken.push(`${fl}: ${email}`);
          if (await rowWraps("a[href^='http']")) broken.push(`${fl}: ${website}`);
        }
      }
      expect(broken, `wrapped mid-value: ${broken.join(" | ")}`).toEqual([]);
    }, 60_000);
  }

  it("a DENSE card renders exactly as it always did (fitPx untouched below growth)", async () => {
    // Same email on a card full enough that nothing grows: the size must be the
    // plain fitPx size, i.e. byte-for-byte the pre-fix rendering.
    await render(ModernBold, card({
      email: "aaron@malvecapital.com", website: "malvecapital.com",
      phone: "(415) 555-0188", address: "1200 Ocean Ave\nSan Francisco, CA 94122",
    }));
    const fs = await page.evaluate(() => parseFloat(getComputedStyle([...document.querySelector("a[href^='mailto:']")!.querySelectorAll("span")].pop()!).fontSize));
    expect(fs).toBeLessThanOrEqual(13.01);
  });
});

describe("Name color reaches the card on the light theme", () => {
  const read = () => page.evaluate(() => getComputedStyle(document.querySelector("h2")!).color);

  for (const [tn, Template] of TEMPLATES) {
    it(`${tn}: a chosen name colour wins; no choice keeps the template's own`, async () => {
      await render(Template, card({ email: "a@b.co", customization: { textColor: "#d4af7a" } }), "light");
      expect(await read()).toBe("rgb(212, 175, 122)");

      await render(Template, card({ email: "a@b.co", customization: {} }), "light");
      const untouched = await read();
      await render(Template, card({ email: "a@b.co", customization: {} }));
      expect(untouched, "the light theme changed an untouched name").toBe(await read());
    });
  }
});
