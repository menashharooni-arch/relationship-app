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
import type { CardData } from "@/components/card-templates/types";

// Cards WITH A LOGO. card-overflow.test.ts covers everything else, but every one
// of its fixtures sets logoUrl: null — so before this file no template was ever
// measured with a logo on it at all. That gap is not theoretical: raising the
// logo sizes immediately surfaced a real collision in local-business, where the
// name block (absolute, bottom-0 left-0, no right bound) ran underneath the
// badge (absolute, top-0 right-0, h-full). It measured 13px of overlap at the
// ORIGINAL badge size, so it had been there all along and simply nothing looked.
//
// measureCard can't catch that class — it inspects text leaves, and a logo is an
// <img>. This file measures the IMAGE: where it sits, what it covers, and
// whether it stays on the card.
//
// The shapes matter as much as the sizes. A logo is sized by height with
// width:auto, so aspect ratio decides the real footprint: a banner gets wide and
// hits its maxWidth cap, a tall crest gets narrow and drives the row height.
// Testing one shape would prove almost nothing.

const svg = (w: number, h: number) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#e11d48"/></svg>`,
  );

const SHAPES: Array<[string, string]> = [
  ["banner 5:1", svg(500, 100)],
  ["square 1:1", svg(200, 200)],
  ["crest 1:2", svg(100, 200)],
];

const BASE: CardData = {
  name: "Alex Morgan", title: "Realtor", company: "Coastline Realty",
  phone: "(415) 555-0188", email: "alex@coastlinerealty.com",
  website: "coastlinehomes.com", initials: "AM", photoUrl: null, logoUrl: null,
  cardUrl: "swiftcard.me/card/alexmorgan",
};

const FIXTURES: Array<[string, CardData]> = [
  // A short company leaves the most spare room in the logo's row — the case
  // where a logo is free to grow biggest, so the likeliest to escape.
  ["short company", { ...BASE, company: "Acme" }],
  ["ordinary", BASE],
  // No company at all: the logo's maxWidth jumps from ~half the row to 88%.
  ["no company", { ...BASE, company: "" }],
  ["long everything", {
    ...BASE,
    name: "Bartholomew Fitzgerald-Montgomery",
    title: "Senior Vice President of Business Development & Strategic Partnerships",
    company: "Northwind Commercial Real Estate Advisors International",
    phone: "+1 (512) 555-0147 ext. 8891",
    email: "bartholomew.fitzgerald-montgomery@northwind-commercial-advisors.com",
    website: "northwind-commercial-real-estate-advisors.com",
  }],
];

const TEMPLATES: Array<[string, React.ComponentType<{ data: CardData }>]> = [
  ["classic-pro", ClassicPro],
  ["modern-bold", ModernBold],
  ["photo-first", PhotoFirst],
  ["local-business", LocalBusiness],
  ["luxury-minimal", LuxuryMinimal],
];

// Matches card-overflow.test.ts: 460 is the real layout width for every card
// (CardScaler lays out at 460 and only scales the pixels); 390 is carried
// because HeroPhone genuinely lays PhotoFirst out there, and holding the others
// to it too is free insurance.
const WIDTHS = [460, 390];
const TOL = 1;

async function inspect(
  browser: Browser, Template: React.ComponentType<{ data: CardData }>, data: CardData, width: number,
): Promise<string[]> {
  const css = await appCss();
  const markup = renderToStaticMarkup(createElement(Template, { data }));
  const page = await browser.newPage({ viewportSize: { width: width + 100, height: 900 } });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
       <style>body{margin:0;padding:20px;background:#fff}#holder{width:${width}px}</style>
       </head><body class="sc-app"><div id="holder">${markup}</div></body></html>`,
      { waitUntil: "load" },
    );
    return await page.evaluate((tol) => {
      const card = document.querySelector(".sc-card") as HTMLElement;
      const cr = card.getBoundingClientRect();
      const img = card.querySelector('img[alt="logo"]') as HTMLImageElement | null;
      const out: string[] = [];
      if (!img) { out.push("no logo rendered at all"); return out; }
      const ir = img.getBoundingClientRect();

      if (ir.width < 4 || ir.height < 4) out.push(`logo collapsed to ${Math.round(ir.width)}x${Math.round(ir.height)}`);
      if (ir.bottom > cr.bottom + tol) out.push(`logo ${Math.round(ir.bottom - cr.bottom)}px below the card`);
      if (ir.top < cr.top - tol) out.push(`logo ${Math.round(cr.top - ir.top)}px above the card`);
      if (ir.right > cr.right + tol) out.push(`logo ${Math.round(ir.right - cr.right)}px past the right edge`);
      if (ir.left < cr.left - tol) out.push(`logo ${Math.round(cr.left - ir.left)}px past the left edge`);

      for (const el of Array.from(card.querySelectorAll<HTMLElement>("*"))) {
        if (el.children.length > 0) continue;
        const text = (el.textContent || "").trim();
        if (!text) continue;
        const r = el.getBoundingClientRect();
        const ox = Math.min(ir.right, r.right) - Math.max(ir.left, r.left);
        const oy = Math.min(ir.bottom, r.bottom) - Math.max(ir.top, r.top);
        if (ox > tol && oy > tol) {
          out.push(`logo covers "${text.slice(0, 22)}" by ${Math.round(ox)}x${Math.round(oy)}px`);
        }
        if (r.bottom > cr.bottom + tol) out.push(`"${text.slice(0, 22)}" ${Math.round(r.bottom - cr.bottom)}px below the card`);
        if (r.right > cr.right + tol) out.push(`"${text.slice(0, 22)}" ${Math.round(r.right - cr.right)}px past the right edge`);
        if (el.scrollWidth - el.clientWidth > tol) out.push(`"${text.slice(0, 22)}" clipped ${el.scrollWidth - el.clientWidth}px inside itself`);
      }

      const ovY = Math.max(0, card.scrollHeight - card.clientHeight);
      if (ovY > 2) out.push(`card content overflows ${ovY}px vertically`);
      return out;
    }, TOL);
  } finally {
    await page.close();
  }
}

describe("a logo never escapes the card, covers text, or pushes content off", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  for (const [tName, Template] of TEMPLATES) {
    for (const width of WIDTHS) {
      it(`${tName} holds every logo shape at ${width}px`, async () => {
        const failures: string[] = [];
        for (const [fName, fixture] of FIXTURES) {
          for (const [sName, uri] of SHAPES) {
            const problems = await inspect(browser, Template, { ...fixture, logoUrl: uri }, width);
            for (const p of problems) failures.push(`${tName} @${width}px [${fName} / ${sName}] — ${p}`);
          }
        }
        expect(failures, failures.join("\n")).toEqual([]);
      }, 180_000);
    }
  }
});

// ── A company name is never split in the middle of a word ───────────────────
//
// This is separate from the geometry above because nothing overflows when it
// happens: the text fits, it is simply cut in a place that makes it stop being
// a name. "COASTLIN / E REALTY" measures perfectly and reads as a mistake.
//
// It only occurs beside a WIDE logo, which is why it survived so long — the
// existing fixtures carried no logo at all, so the narrow-column case that
// causes it was never rendered.
//
// The check reconstructs the real rendered lines from per-character Range
// rects, so it sees what a reader sees rather than what the CSS implies. A
// break is fine at a space or a hyphen and a failure anywhere else.
const COMPANY_NAMES = [
  "Coastline Realty",
  "Bartholomew & Associates",       // wide caps: M and W are ~2x an I
  "Konstantinopoulos Properties",   // one very long word
  "Northwind Commercial Real Estate Advisors International",
];

async function midWordSplits(
  browser: Browser, Template: React.ComponentType<{ data: CardData }>, data: CardData, width: number,
): Promise<string[]> {
  const css = await appCss();
  const markup = renderToStaticMarkup(createElement(Template, { data }));
  const page = await browser.newPage({ viewportSize: { width: width + 100, height: 600 } });
  try {
    await page.setContent(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style>
       <style>body{margin:0;padding:20px}#h{width:${width}px}</style></head>
       <body class="sc-app"><div id="h">${markup}</div></body></html>`, { waitUntil: "load" });
    return await page.evaluate(() => {
      const card = document.querySelector(".sc-card") as HTMLElement;
      const out: string[] = [];
      for (const el of Array.from(card.querySelectorAll<HTMLElement>("*"))) {
        if (el.children.length > 0) continue;
        const node = el.firstChild;
        if (!node || node.nodeType !== 3) continue;
        const text = node.textContent || "";
        // Emails and URLs have no spaces and MUST be free to break anywhere —
        // that is correct behaviour, not a defect, so they are excluded.
        if (text.trim().length < 2 || /[@]/.test(text) || /\w\.\w{2,}/.test(text)) continue;
        const range = document.createRange();
        let prevTop: number | null = null;
        for (let i = 0; i < text.length; i++) {
          range.setStart(node, i); range.setEnd(node, i + 1);
          const r = range.getBoundingClientRect();
          if (r.height === 0) continue;
          const top = Math.round(r.top);
          if (prevTop !== null && top > prevTop + 2) {
            const prev = text[i - 1] ?? "";
            const cur = text[i] ?? "";
            if (!/[\s\-–—/]/.test(prev) && !/\s/.test(cur)) {
              out.push(`"${text.slice(0, 34)}" splits ...${text.slice(Math.max(0, i - 4), i)}|${text.slice(i, i + 4)}...`);
            }
          }
          prevTop = top;
        }
      }
      return out;
    });
  } finally {
    await page.close();
  }
}

describe("a company name is never split mid-word", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  for (const [tName, Template] of TEMPLATES) {
    it(`${tName} keeps every company name's words whole`, async () => {
      const failures: string[] = [];
      for (const company of COMPANY_NAMES) {
        for (const [sName, uri] of SHAPES) {
          for (const width of WIDTHS) {
            const splits = await midWordSplits(browser, Template, { ...BASE, company, logoUrl: uri }, width);
            for (const s of splits) failures.push(`${tName} @${width}px [${sName}] ${s}`);
          }
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    }, 240_000);
  }
});

// Keeping a word whole is trivially achievable by making it tiny, and that is
// not a fix — it swaps one unreadable name for another. The first attempt here
// did exactly that: "Konstantinopoulos" came out whole at 5.9px. The logo
// yielding some width is what buys the size back, and this is what holds it to
// that: a company name has to stay large enough to read, at the SAME time as
// staying unsplit. Neither assertion means much without the other.
describe("a company name stays readable while it stays whole", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  // Design px at the 460 layout. Below ~6.5 a name is present but not really
  // legible once the card is scaled down on a phone.
  const MIN_READABLE = 6.5;

  for (const [tName, Template] of TEMPLATES) {
    it(`${tName} never shrinks a company name below ${MIN_READABLE}px to make it fit`, async () => {
      const css = await appCss();
      const failures: string[] = [];
      for (const company of ["Coastline Realty", "Bartholomew & Associates", "Konstantinopoulos Properties"]) {
        const data = { ...BASE, company, logoUrl: SHAPES[0][1] }; // banner: the tight case
        const markup = renderToStaticMarkup(createElement(Template, { data }));
        const page = await browser.newPage({ viewportSize: { width: 560, height: 500 } });
        try {
          await page.setContent(
            `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style>
             <style>body{margin:0;padding:20px}#h{width:460px}</style></head>
             <body class="sc-app"><div id="h">${markup}</div></body></html>`, { waitUntil: "load" });
          const px = await page.evaluate((needle) => {
            const card = document.querySelector(".sc-card") as HTMLElement;
            const el = Array.from(card.querySelectorAll<HTMLElement>("*"))
              .find((e) => e.children.length === 0 && (e.textContent || "").trim() === needle);
            return el ? parseFloat(getComputedStyle(el).fontSize) : null;
          }, company);
          if (px !== null && px < MIN_READABLE) {
            failures.push(`${tName} renders "${company}" at ${px.toFixed(1)}px — whole, but too small to read`);
          }
        } finally {
          await page.close();
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    }, 180_000);
  }
});
