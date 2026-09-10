import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ComponentProps } from "react";
import { launchBrowser, appCss } from "./harness";

import SwiftLinkProfile from "@/components/SwiftLinkProfile";
import { SwiftLinkStyleControls } from "@/components/SwiftLinkDesign";
import { getLook } from "@/lib/swiftlink-looks";

// ── The Social design panel reads top to bottom ─────────────────────────────
//
// Owner, 2026-09-10: "If I'm making a social design I'm starting from top to
// bottom. I don't have to go to the top, start, go down, and then, 'Oh, I get
// to the end and I see something that should have been at the top'."
//
// So the panel is a route, in two parts: the whole surface first, then the
// page's own parts in the order a visitor scrolls past them. That second order
// is not a matter of taste — it is the page itself — which makes it exactly the
// kind of thing to pin, because a future section will otherwise be appended
// wherever the file happens to end.
//
// Measured in the DOM rather than read out of the source: what matters is the
// order these land on screen, and a source scan cannot see a section that
// renders conditionally or one that a wrapper reorders.

type PickerProps = ComponentProps<typeof SwiftLinkStyleControls>;
type ProfileProps = ComponentProps<typeof SwiftLinkProfile>;

const LINKS = [
  { emoji: "", label: "Testimonials", url: "https://a.com", size: "compact" as const, rowStyle: "solid" as const },
];

describe("panel order", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  async function sections(props: Partial<PickerProps> = {}) {
    const css = await appCss();
    const markup = renderToStaticMarkup(createElement(SwiftLinkStyleControls, {
      value: {}, onChange: () => {}, links: LINKS, onLinksChange: () => {}, ...props,
    } as PickerProps));
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: 400, height: 2600 });
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
         <style>body{margin:0;padding:12px;background:#0b0f16}</style></head>
         <body class="sc-app"><div style="width:376px">${markup}</div></body></html>`,
        { waitUntil: "load" },
      );
      await page.waitForTimeout(200);
      return await page.evaluate(() => {
        // Group headings and section labels, in document order, by their real
        // vertical position on screen.
        // NOT filtered to leaf nodes: on a Free account a section label owns a
        // <ProTag> span, so the label element has a child and a leaf-only scan
        // finds nothing. Exact-matching the trimmed text (with an optional
        // trailing "PRO") is what makes both plans measurable the same way.
        const nodes = [...document.querySelectorAll("span, p")] as HTMLElement[];
        const items = nodes
          .map((el) => ({
            text: (el.textContent || "").trim(),
            y: el.getBoundingClientRect().top,
            cls: el.className,
          }))
          .filter((i) => i.text.length > 0);
        const wanted = ["The page", "On the page", "Look", "Page background", "Text color", "Font",
          "Page header", "Social icons", "Connect button", "Link buttons"];
        const found: string[] = [];
        for (const i of items.sort((a, b) => a.y - b.y)) {
          const hit = wanted.find((w) => i.text === w || i.text === `${w}PRO`);
          if (hit && !found.includes(hit)) found.push(hit);
        }
        return found;
      });
    } finally {
      await page.close();
    }
  }

  it("puts the whole surface first, then the page's parts in visitor order", async () => {
    expect(await sections()).toEqual([
      // THE PAGE — the preset, then the three things that repaint all of it.
      "The page", "Look", "Page background", "Text color", "Font",
      // ON THE PAGE — exactly the order a visitor scrolls past them.
      "On the page", "Page header", "Social icons", "Connect button", "Link buttons",
    ]);
  }, 60_000);

  it("keeps that order for a Free account, where every section still renders", async () => {
    const order = await sections({ locked: true });
    expect(order.indexOf("Page background")).toBeGreaterThan(order.indexOf("Look"));
    expect(order.indexOf("Text color")).toBeGreaterThan(order.indexOf("Page background"));
    expect(order.indexOf("Page header")).toBeGreaterThan(order.indexOf("Font"));
    expect(order.indexOf("Connect button")).toBeGreaterThan(order.indexOf("Social icons"));
    expect(order.indexOf("Link buttons")).toBeGreaterThan(order.indexOf("Connect button"));
  }, 60_000);

  it("fits a phone with nothing clipped or spilling out", async () => {
    // This panel lives on a 390px screen far more often than on a desktop, and
    // it is the width where a two-column swatch grid, a wrapped group blurb and
    // a long section description are all closest to breaking.
    const css = await appCss();
    const markup = renderToStaticMarkup(createElement(SwiftLinkStyleControls, {
      value: { linkLook: "aurora", linkHeroStyle: "cover", linkAccentColor: "#0F766E" },
      onChange: () => {}, links: LINKS, onLinksChange: () => {},
    } as PickerProps));
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: 390, height: 3000 });
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
         <style>body{margin:0;padding:8px;background:#0b0f16}</style></head>
         <body class="sc-app"><div id="panel" style="width:374px">${markup}</div></body></html>`,
        { waitUntil: "load" },
      );
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => {
        const panel = document.getElementById("panel")!;
        const box = panel.getBoundingClientRect();
        const spills: string[] = [];
        const clipped: string[] = [];
        for (const el of Array.from(panel.querySelectorAll<HTMLElement>("*"))) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 && b.height === 0) continue;
          if (b.right > box.right + 1 || b.left < box.left - 1) {
            spills.push(`${el.tagName}.${String(el.className).slice(0, 40)}`);
          }
          // Text cut off inside its own box.
          if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1) {
            clipped.push((el.textContent || "").trim().slice(0, 40));
          }
        }
        return {
          spills: [...new Set(spills)].slice(0, 6),
          clipped: [...new Set(clipped)].slice(0, 6),
          scrollsSideways: panel.scrollWidth > panel.clientWidth + 1,
        };
      });
      expect(r.spills).toEqual([]);
      expect(r.clipped).toEqual([]);
      expect(r.scrollsSideways).toBe(false);
    } finally {
      await page.close();
    }
  }, 60_000);

  it("offers the compact-circle switch inside Page background, not by scrolling", async () => {
    // Page header now sits BELOW Page background, so the photo/video option
    // has to be reachable from where it is described. Without this the panel
    // order would have to go back to putting the header first.
    const css = await appCss();
    const markup = renderToStaticMarkup(createElement(SwiftLinkStyleControls, {
      value: { linkHeroStyle: "cover" }, onChange: () => {}, links: LINKS, onLinksChange: () => {},
    } as PickerProps));
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: 400, height: 2600 });
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
         <body class="sc-app"><div style="width:376px">${markup}</div></body></html>`,
        { waitUntil: "load" },
      );
      const r = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => /compact circle/i.test(b.textContent || ""));
        const bgLabel = [...document.querySelectorAll("p")].find((p) => (p.textContent || "").trim().startsWith("Page background"));
        const headerLabel = [...document.querySelectorAll("p")].find((p) => (p.textContent || "").trim() === "Page header");
        return {
          hasSwitch: !!btn,
          // It must live in the background section, above the header section.
          switchY: btn?.getBoundingClientRect().top ?? -1,
          bgY: bgLabel?.getBoundingClientRect().top ?? -1,
          headerY: headerLabel?.getBoundingClientRect().top ?? -1,
        };
      });
      expect(r.hasSwitch).toBe(true);
      expect(r.switchY).toBeGreaterThan(r.bgY);
      expect(r.switchY).toBeLessThan(r.headerY);
    } finally {
      await page.close();
    }
  }, 60_000);
});

// ── The accent reaches everything that is a call to action ─────────────────
describe("the Connect button colour", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  const BASE: Omit<ProfileProps, "pageStyle"> = {
    name: "Kelsie", username: "kelsie", photoUrl: null, logoUrl: null,
    subtitle: "Realtor", bio: "NC.", verified: false,
    socials: [{ label: "Instagram", href: "https://instagram.com/x", color: "#E4405F", textColor: "#fff" }] as ProfileProps["socials"],
    links: LINKS, appUrl: "https://swiftcard.me", embedded: true, paidTiles: true,
  };

  async function probe(pageStyle: ProfileProps["pageStyle"]) {
    const css = await appCss();
    const markup = renderToStaticMarkup(createElement(SwiftLinkProfile, { ...BASE, pageStyle }));
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: 430, height: 900 });
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
         <body><div style="width:430px">${markup}</div></body></html>`, { waitUntil: "load" });
      await page.waitForTimeout(150);
      return await page.evaluate(() => {
        const connect = [...document.querySelectorAll("button, a")].find((e) => /Connect with/i.test(e.textContent || "")) as HTMLElement;
        const chip = document.querySelector('a[href*="instagram"]') as HTMLElement;
        const row = [...document.querySelectorAll('a[href^="https://a.com"]')][0] as HTMLElement;
        const label = row?.querySelector("span:nth-child(2)") as HTMLElement;
        return {
          connectBg: connect ? getComputedStyle(connect).backgroundColor : null,
          connectText: connect ? getComputedStyle(connect).color : null,
          chipBg: chip ? getComputedStyle(chip).backgroundColor : null,
          rowBg: row ? getComputedStyle(row).backgroundColor : null,
          rowText: label ? getComputedStyle(label).color : null,
        };
      });
    } finally {
      await page.close();
    }
  }

  it("colours the Connect button, accent social chips and the solid row together", async () => {
    const r = await probe({ look: "paper", heroStyle: "avatar", iconFill: "accent", accent: "#0F766E" });
    expect(r.connectBg).toBe("rgb(15, 118, 110)");
    expect(r.chipBg).toBe("rgb(15, 118, 110)");
    expect(r.rowBg).toBe("rgb(15, 118, 110)");
  }, 60_000);

  it("derives the label colour from the accent's lightness", async () => {
    // The Look's own accent/accentText pair is AA-tested against each other; a
    // custom colour cannot be, so white-on-yellow must not be possible.
    const dark = await probe({ look: "paper", heroStyle: "avatar", accent: "#0F766E" });
    expect(dark.connectText).toBe("rgb(255, 255, 255)");
    const lightAccent = await probe({ look: "paper", heroStyle: "avatar", accent: "#FACC15" });
    expect(lightAccent.connectText).toBe("rgb(17, 24, 39)");
  }, 60_000);

  it("falls back to the Look for anything that is not a plain hex", async () => {
    // Arrives through client-writable customization onto a public page.
    for (const bad of ["red", "javascript:x", "#GGGGGG", "#fff", ""]) {
      const r = await probe({ look: "paper", heroStyle: "avatar", accent: bad });
      const look = getLook("paper");
      const [rr, gg, bb] = [1, 3, 5].map((i) => parseInt(look.accent.slice(i, i + 2), 16));
      expect(r.connectBg, bad || "(empty)").toBe(`rgb(${rr}, ${gg}, ${bb})`);
    }
  }, 60_000);

  it("leaves a page with no override on its Look's own accent", async () => {
    const r = await probe({ look: "forest", heroStyle: "avatar" });
    expect(r.connectBg).toBe("rgb(16, 185, 129)"); // Forest's #10B981
  }, 60_000);
});
