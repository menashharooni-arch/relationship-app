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

// ── The exhaustive fit sweep ────────────────────────────────────────────────
//
// Owner, 2026-09-20: "You need to make sure nothing ever cuts off of the card…
// on one of my cards right now, it has my phone number on it and then it says
// 'mobile' next to it. It's cutting off of the card so it only says a few of
// the letters. This cannot happen… for every card, every template, every
// design, and also from one thing only on the card to every scenario with
// everything on the card."
//
// card-overflow and card-detail-fit already sweep content scenarios. They did
// not catch that, and the two reasons they could not are the reasons this file
// exists:
//
// 1. THEY MEASURE ELEMENTS, NOT TEXT. Both skip any element with children
//    (`if (el.children.length > 0) continue`) because a wrapper "overflows"
//    merely because its child does. But the phone row is
//    `<span nowrap>{number}<span>{label}</span></span>` — the NUMBER is a bare
//    text node in an element that has a child, so it is skipped by the leaf
//    rule, and it is the half that gets pushed out. Here every TEXT NODE is
//    measured with a Range, which reports the painted extent of the run itself
//    and is immune to how the markup happens to be nested.
//
// 2. THEY ONLY EVER RENDER ONE TYPEFACE. Owners pick from CARD_FONT_OPTIONS,
//    and Courier New's digits are 8% wider than Arial's while Georgia's caps
//    run wider still. Every fit constant in shared.tsx was calibrated in Arial.
//    A row that clears the edge by 4px in the default font is off the card in
//    Mono — which is a card the product will happily let someone save.
//
// Fixtures are things people type, not adversarial garbage: the point is that
// a working realtor cannot produce a broken card, not that we survive a
// 500-character emoji bomb.

const TEMPLATES: Array<[string, React.ComponentType<{ data: CardData }>]> = [
  ["classic-pro", ClassicPro],
  ["modern-bold", ModernBold],
  ["photo-first", PhotoFirst],
  ["local-business", LocalBusiness],
  ["luxury-minimal", LuxuryMinimal],
  ["logo-first", LogoFirst],
];

// Every typeface an owner can actually choose, plus the unset default. The
// harness has no next/font, so Geist resolves to system-ui here — which is the
// honest reproduction of the OG image generator and any non-browser renderer.
const FONTS: Array<[string, string | undefined]> = [
  ["default", undefined],
  ["sans", "var(--font-geist-sans), system-ui, sans-serif"],
  ["serif", "Georgia, 'Times New Roman', serif"],
  ["mono", "'Courier New', ui-monospace, monospace"],
  ["rounded", "'Trebuchet MS', system-ui, sans-serif"],
];

const BASE: CardData = {
  name: "Alex Morgan",
  title: "Realtor",
  company: "Coastline Realty",
  phone: "",
  email: "",
  website: "",
  initials: "AM",
  photoUrl: null,
  logoUrl: null,
  cardUrl: "swiftcard.me/card/alexmorgan",
};

type Phone = { number: string; label: string; showOnCard: boolean };
const ph = (number: string, label: string): Phone => ({ number, label, showOnCard: true });

const ADDR2 = "1200 Ocean Ave, Suite 400\nSan Francisco, CA 94122";
const ADDR3 = "1200 Ocean Avenue, Suite 400\nBuilding C, North Tower\nSan Francisco, CA 94122";
const LONG_EMAIL = "alexander.morgan-whitfield@coastlinerealtygroup.com";

/**
 * From one thing on the card to everything on it.
 *
 * The labelled-phone rows are the ones the owner reported, so they are swept
 * deliberately: every label at every phone count, alone and alongside a full
 * card, and with the longest number the editor accepts (an extension).
 */
const SCENARIOS: Array<[string, CardData]> = [
  // ── one thing only ──────────────────────────────────────────────────────
  ["nothing but a name", BASE],
  ["phone only", { ...BASE, phone: "(415) 555-0188" }],
  ["email only", { ...BASE, email: "alex@coastlinerealty.com" }],
  ["website only", { ...BASE, website: "coastlinehomes.com" }],
  ["address only", { ...BASE, address: ADDR2 }],
  ["fax only", { ...BASE, customization: { fax: "(415) 555-0100" } }],

  // ── one labelled phone, every label, every plausible number shape ───────
  ["one phone labelled mobile", { ...BASE, customization: { phones: [ph("(415) 555-0188", "mobile")] } }],
  ["one phone labelled office", { ...BASE, customization: { phones: [ph("(415) 555-0188", "office")] } }],
  ["one phone labelled direct", { ...BASE, customization: { phones: [ph("(415) 555-0188", "direct")] } }],
  ["one phone labelled home", { ...BASE, customization: { phones: [ph("(415) 555-0188", "home")] } }],
  ["labelled 11-digit number", { ...BASE, customization: { phones: [ph("+1 (415) 555-0188", "mobile")] } }],
  ["labelled number with extension", { ...BASE, customization: { phones: [ph("+1 (512) 555-0147 ext. 8891", "mobile")] } }],
  ["labelled international number", { ...BASE, customization: { phones: [ph("+44 20 7946 0958", "office")] } }],

  // ── labelled phones on an otherwise full card ───────────────────────────
  ["mobile + full card", { ...BASE, email: "alex@coastlinerealty.com", website: "coastlinehomes.com",
    customization: { phones: [ph("(415) 555-0188", "mobile")] } }],
  ["two labelled phones", { ...BASE, email: "alex@coastlinerealty.com", website: "coastlinehomes.com",
    customization: { phones: [ph("(415) 555-0188", "mobile"), ph("(415) 555-0199", "office")] } }],
  ["three labelled phones", { ...BASE, email: "alex@coastlinerealty.com", website: "coastlinehomes.com",
    customization: { phones: [ph("(415) 555-0188", "mobile"), ph("(415) 555-0199", "office"), ph("(415) 555-0177", "direct")] } }],
  ["four labelled phones", { ...BASE, email: "alex@coastlinerealty.com", website: "coastlinehomes.com",
    customization: { phones: [ph("(415) 555-0188", "mobile"), ph("(415) 555-0199", "office"),
      ph("(415) 555-0177", "direct"), ph("(415) 555-0166", "home")] } }],

  // ── ordinary, and the way most cards actually look ──────────────────────
  ["ordinary", { ...BASE, phone: "(415) 555-0188", email: "alex@coastlinerealty.com", website: "coastlinehomes.com" }],
  ["ordinary + address", { ...BASE, phone: "(415) 555-0188", email: "alex@coastlinerealty.com",
    website: "coastlinehomes.com", address: ADDR2 }],
  ["ordinary + logo", { ...BASE, phone: "(415) 555-0188", email: "alex@coastlinerealty.com",
    website: "coastlinehomes.com", logoUrl: "/demo/avatar.svg" }],
  ["ordinary + photo", { ...BASE, phone: "(415) 555-0188", email: "alex@coastlinerealty.com",
    website: "coastlinehomes.com", photoUrl: "/demo/avatar.svg" }],

  // ── long single values ──────────────────────────────────────────────────
  ["a very long email", { ...BASE, email: "bartholomew.fitzgerald-montgomery@northwind-commercial-advisors.com" }],
  ["an email with nothing to break on", { ...BASE, email: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.com" }],
  ["a very long website", { ...BASE, website: "northwind-commercial-real-estate-advisors-international.com" }],
  ["one unbroken address line", { ...BASE, address: "Unit 14B Kensington Court Mansions Cromwell Road London SW7 4QH United Kingdom" }],
  ["a long name, title and company", { ...BASE,
    name: "Bartholomew Fitzgerald-Montgomery",
    title: "Senior Vice President of Business Development & Strategic Partnerships",
    company: "Northwind Commercial Real Estate Advisors International",
    phone: "+1 (512) 555-0147 ext. 8891", email: LONG_EMAIL, website: "northwind-commercial-advisors.com" }],
  ["a long company beside a logo", { ...BASE, logoUrl: "/demo/avatar.svg",
    company: "Northwind Commercial Real Estate Advisors International",
    phone: "(415) 555-0188", email: "alex@coastlinerealty.com" }],
  ["accented name and address", { ...BASE, name: "Zoë Müller-Ståhl",
    company: "Ståhl & Compagnie Immobilière", email: "zoe.muller-stahl@immobiliere-cote-dazur.fr",
    address: "12 Rue de l’Église\n06400 Cannes, France" }],

  // ── everything on the card at once ──────────────────────────────────────
  ["everything at once", { ...BASE,
    title: "Senior Vice President of Business Development",
    email: LONG_EMAIL, website: "coastlinerealtygroup.com", address: ADDR3,
    logoUrl: "/demo/avatar.svg", photoUrl: "/demo/avatar.svg",
    linkedin: "alexmorgan", instagram: "alexmorgan", twitter: "alexmorgan", tiktok: "alexmorgan",
    customization: { fax: "(415) 555-0100", phones: [
      ph("+1 (512) 555-0147 ext. 8891", "mobile"), ph("(415) 555-0199", "office"), ph("(415) 555-0177", "direct")] } }],
  ["everything, longest of everything", { ...BASE,
    name: "Bartholomew Fitzgerald-Montgomery",
    title: "Senior Vice President of Business Development & Strategic Partnerships",
    company: "Northwind Commercial Real Estate Advisors International",
    email: "bartholomew.fitzgerald-montgomery@northwind-commercial-advisors.com",
    website: "northwind-commercial-real-estate-advisors-international.com",
    address: "1200 Ocean Avenue, Suite 400\nBuilding C, North Tower\nSan Francisco, CA 94122\nUnited States",
    logoUrl: "/demo/avatar.svg", photoUrl: "/demo/avatar.svg",
    linkedin: "alexmorgan", instagram: "alexmorgan", twitter: "alexmorgan", tiktok: "alexmorgan",
    customization: { fax: "+1 (415) 555-0100", phones: [
      ph("+1 (512) 555-0147 ext. 8891", "mobile"), ph("+1 (415) 555-0199", "office"),
      ph("+1 (415) 555-0177", "direct"), ph("+1 (415) 555-0166", "home")] } }],
];

/** The one layout width a card is ever laid out at — see card-overflow.test.ts. */
const WIDTH = 460;

type Escape = { text: string; over: string };

/**
 * Measure one rendered card: what text escapes, and what text collides.
 *
 * Text nodes, via Range — not elements. See the header: the element rule
 * cannot see a bare text node that shares its parent with another element,
 * which is exactly the shape of the phone row.
 */
async function probe(page: Page, css: string, Template: React.ComponentType<{ data: CardData }>, data: CardData) {
  const markup = renderToStaticMarkup(createElement(Template, { data }));
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
     <style>body{margin:0;padding:20px;background:#fff}#h{width:${WIDTH}px}</style></head>
     <body class="sc-app"><div id="h">${markup}</div></body></html>`,
    { waitUntil: "load" },
  );
  return page.evaluate(() => {
    const card = document.querySelector(".sc-card") as HTMLElement;
    const cr = card.getBoundingClientRect();
    // Sub-pixel rounding and antialiasing produce ~0.5px of slop; below a pixel
    // nothing is visibly missing and treating it as a defect makes every run a
    // coin flip.
    const TOL = 1;
    const escapes: Escape[] = [];

    type Run = { text: string; rect: DOMRect; el: HTMLElement };
    const runs: Run[] = [];

    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent || "").trim();
      if (!text) continue;
      const el = n.parentElement as HTMLElement;
      if (!el) continue;
      // Decoration is not content. LuxuryMinimal lays a 100px ghost monogram
      // behind the name on purpose and marks the whole layer aria-hidden;
      // measuring it reports 270 "overlaps" that are the design working as
      // drawn. aria-hidden is the authored signal for exactly this, so it is
      // what gets trusted here rather than a guess at an opacity threshold.
      let decorative = false;
      for (let a: HTMLElement | null = el; a && a !== card; a = a.parentElement) {
        if (a.getAttribute("aria-hidden") === "true") { decorative = true; break; }
      }
      if (decorative) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (!rects.length) continue;

      for (const r of rects) {
        const over = [
          r.right > cr.right + TOL ? `${Math.round(r.right - cr.right)}px past the right edge` : "",
          r.left < cr.left - TOL ? `${Math.round(cr.left - r.left)}px past the left edge` : "",
          r.bottom > cr.bottom + TOL ? `${Math.round(r.bottom - cr.bottom)}px below the bottom` : "",
          r.top < cr.top - TOL ? `${Math.round(cr.top - r.top)}px above the top` : "",
        ].filter(Boolean).join(", ");
        if (over) escapes.push({ text: text.slice(0, 40), over });

        // …and clipped by any ancestor that hides its overflow, which the card
        // edge check alone cannot see (a panel with overflow:hidden inside it).
        for (let a: HTMLElement | null = el; a && a !== card; a = a.parentElement) {
          const cs = getComputedStyle(a);
          if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
          const ar = a.getBoundingClientRect();
          if (r.right > ar.right + TOL || r.bottom > ar.bottom + TOL || r.left < ar.left - TOL) {
            escapes.push({ text: text.slice(0, 40), over: `clipped by an ancestor that hides overflow` });
          }
        }
      }
      // Overlap is judged on the element's LAYOUT BOX, not on the text run.
      //
      // Range rects report the font's ink box (ascent + descent), which on a
      // display line set at line-height 1.08 is a couple of px taller than the
      // line box itself. Two stacked headings therefore "intersect" by ~2px in
      // every template while looking perfectly normal — that is ordinary
      // typography, not a collision. The layout box is the thing that actually
      // decides whether a row lands on the QR.
      runs.push({ text, rect: el.getBoundingClientRect(), el });
    }

    // ── Nothing overlapping ────────────────────────────────────────────────
    // A distinct failure from clipping: grown text can collide with the QR or
    // with the row under it while the card still reports no overflow.
    const overlaps: string[] = [];
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        const a = runs[i], b = runs[j];
        if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ox = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const oy = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (ox > 2 && oy > 2) overlaps.push(`"${a.text.slice(0, 18)}" over "${b.text.slice(0, 18)}"`);
      }
    }

    // ── The QR must stay clear and stay on the card ───────────────────────
    // It is the one element that stops WORKING when something lands on it: a
    // covered QR still looks like a QR and simply will not scan.
    const qr = card.querySelector("[data-qr]") as HTMLElement | null;
    if (qr) {
      const q = qr.getBoundingClientRect();
      const qOver = [
        q.right > cr.right + TOL ? `${Math.round(q.right - cr.right)}px past the right edge` : "",
        q.left < cr.left - TOL ? `${Math.round(cr.left - q.left)}px past the left edge` : "",
        q.bottom > cr.bottom + TOL ? `${Math.round(q.bottom - cr.bottom)}px below the bottom` : "",
        q.top < cr.top - TOL ? `${Math.round(cr.top - q.top)}px above the top` : "",
      ].filter(Boolean).join(", ");
      if (qOver) escapes.push({ text: "[QR]", over: qOver });
      for (const r of runs) {
        const ox = Math.min(q.right, r.rect.right) - Math.max(q.left, r.rect.left);
        const oy = Math.min(q.bottom, r.rect.bottom) - Math.max(q.top, r.rect.top);
        if (ox > 1 && oy > 1) overlaps.push(`"${r.text.slice(0, 18)}" covers the QR`);
      }
    }

    const key = (e: Escape) => `${e.text} — ${e.over}`;
    return {
      escapes: [...new Map(escapes.map((e) => [key(e), e])).values()].map(key),
      overlaps: [...new Set(overlaps)],
    };
  });
}

describe("nothing on a card is ever cut off, in any template, font or content shape", () => {
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
    it(`${tname}: every content shape fits, in every typeface`, async () => {
      const failures: string[] = [];
      for (const [fname, fontFamily] of FONTS) {
        for (const [sname, data] of SCENARIOS) {
          const withFont: CardData = fontFamily
            ? { ...data, customization: { ...(data.customization ?? {}), fontFamily } }
            : data;
          const r = await probe(page, css, Template, withFont);
          for (const e of r.escapes) failures.push(`[${fname}] ${sname}: ${e}`);
          for (const o of r.overlaps) failures.push(`[${fname}] ${sname}: OVERLAP ${o}`);
        }
      }
      expect(failures, `${tname}\n  ${failures.join("\n  ")}`).toEqual([]);
    }, 300_000);
  }
});
