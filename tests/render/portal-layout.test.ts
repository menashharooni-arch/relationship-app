import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ComponentType } from "react";
import type { Browser } from "playwright";
import { appCss, launchBrowser } from "./harness";
import ClassicPro from "@/components/card-templates/ClassicPro";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import ModernBold from "@/components/card-templates/ModernBold";
import { SAMPLE_DATA_WITH_PHOTO, withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";

// RENDER TESTS for the authenticated portal's layout.
//
// The real dashboard is behind login, so a crawler can't reach it. These lay the
// portal's own panels out at real desktop column widths with the app's compiled
// CSS and measure — the same technique that caught the Download button
// collapsing to 79px.
//
// Pathological, not boundary: every fixture is longer than anything a real user
// is likely to type, so a pass means "fits in any font", not "fits in Arial on
// this machine".

const NAT = 460; // CardScaler's natural card width — see card-design-unit note.

// The portal's own column widths: the sticky right rail on a laptop, on a wide
// monitor, and the full-width single column a narrow window collapses to.
const COLUMNS = [280, 320, 384, 460];

let browser: Browser;
beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
afterAll(async () => { await browser?.close(); });

/** Render a card inside the portal's "Your Card" panel and measure what escapes. */
async function measurePanel(Template: ComponentType<{ data: CardData }>, data: CardData, colWidth: number) {
  const css = await appCss();
  const markup = renderToStaticMarkup(createElement(Template, { data }));
  const scale = (colWidth - 40) / NAT; // panel p-5 = 20px each side
  const page = await browser.newPage({ viewportSize: { width: colWidth + 160, height: 1000 } });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
       <style>body{margin:0;padding:20px;background:#030712}
       #panel{width:${colWidth}px}
       #scaler{width:${NAT}px;transform:scale(${scale});transform-origin:top left}
       #clip{width:${colWidth - 40}px;overflow:hidden}</style>
       </head><body class="sc-app">
         <div id="panel" class="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
           <p class="text-gray-500 text-xs font-semibold uppercase tracking-wide">Your Card</p>
           <div id="clip"><div id="scaler">${markup}</div></div>
         </div>
       </body></html>`,
    );
    return await page.evaluate(() => {
      const clip = document.getElementById("clip")!;
      const scaler = document.getElementById("scaler")!;
      const card = scaler.firstElementChild as HTMLElement;
      const cardBox = card.getBoundingClientRect();
      const clipBox = clip.getBoundingClientRect();
      return {
        panelScrollsX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        // PAINTED geometry, not scrollWidth. CardScaler sizes the card with a CSS
        // transform, and scrollWidth reports the UNSCALED layout box — so the
        // naive check reported the same bogus 460-minus-column overflow for every
        // template at every width. getBoundingClientRect is post-transform, which
        // is what the eye actually sees.
        cardOverflowX: Math.round(cardBox.right - clipBox.right),
      };
    });
  } finally {
    await page.close();
  }
}

// Long-but-plausible portal data. A real estate broker with a long firm name is
// not an edge case — it is Tuesday.
const LONG: CardData = withoutSocials({
  ...SAMPLE_DATA_WITH_PHOTO,
  name: "Alexandra Featherstonehaugh",
  title: "Senior Managing Broker & Relocation Specialist",
  company: "Featherstonehaugh & Wintersmith Realty Partners",
  email: "alexandra.featherstonehaugh@featherstonehaughrealty.com",
  phone: "+1 (415) 555-0188 ext. 4471",
  website: "featherstonehaughwintersmithrealty.com",
  address: "18200 Ocean Meadow Boulevard, Suite 2400, San Francisco, CA 94122",
});

const TEMPLATES: [string, ComponentType<{ data: CardData }>][] = [
  ["classic-pro", ClassicPro], ["modern-bold", ModernBold], ["photo-first", PhotoFirst],
  ["local-business", LocalBusiness], ["luxury-minimal", LuxuryMinimal],
];

describe("the portal's card panel holds its content", () => {
  for (const [name, Template] of TEMPLATES) {
    it(`${name} stays inside the panel at every portal column width`, async () => {
      for (const col of COLUMNS) {
        const m = await measurePanel(Template, LONG, col);
        expect(m.cardOverflowX, `${name} @${col}px: card paints ${m.cardOverflowX}px past the panel`)
          .toBeLessThanOrEqual(1);
        expect(m.panelScrollsX, `${name} @${col}px: the panel forces sideways scroll`).toBeLessThanOrEqual(1);
        // Per-ELEMENT clipping inside the card is card-overflow.test.ts's job and
        // is proven there. Asserting it again here looked thorough but I could not
        // make it fail on demand — the templates auto-fit text by character count,
        // so even a 200-char email shrinks until it fits — so it would have been a
        // vacuous assertion. This file owns one question: does the card fit the
        // portal's panel.
      }
    }, 120_000);
  }
});

describe("the marketing demo card never offers live contact links", () => {
  // The demo persona is fictional and coastlinehomes.com is not ours, so every
  // marketing surface that renders a real template must neutralise its links.
  // Four already did; three didn't, and shipped clickable mailto:/tel:/https:
  // targets on the homepage, /templates, /products/analytics and /products/wallet.
  const FILES = [
    "src/components/site/DashboardDemo.tsx",
    "src/components/site/ShareWaysPhones.tsx",
    "src/app/templates/page.tsx",
    "src/components/site/TemplateGallery.tsx",
    "src/components/site/LeadCapturePhone.tsx",
    "src/components/site/SignatureDemo.tsx",
  ];
  it.each(FILES)("%s neutralises pointer events on its demo card", async (file) => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(file, "utf8");
    // The template render and the guard must both be present in the same file.
    expect(src, `${file} renders a card template`).toMatch(/CardScaler|<(ClassicPro|PhotoFirst|LocalBusiness|LuxuryMinimal|ModernBold|Component|t\.Component)\b/);
    expect(src, `${file} lets visitors click the fake persona's contact details`)
      .toMatch(/pointerEvents:\s*"none"|pointer-events-none/);
  });
});
