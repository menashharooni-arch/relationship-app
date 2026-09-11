import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { launchBrowser, appCss } from "./harness";
import OfficeBranding from "@/components/OfficeBranding";

// The admin's Branding page gained a second lock, and its two "who controls
// what" lists were corrected. Both are claims a compliance-minded buyer will
// read closely, so they are measured in a real render rather than trusted.

const office = (locks: Record<string, boolean>) => ({
  id: "o1", name: "Northwind Partners", seats: 15,
  brand_company: "Northwind Partners", brand_website: "northwind.com",
  brand_logo_url: null, brand_template: "classic-pro", brand_design: null,
  brand_phone: null, brand_fax: null, brand_address: null,
  brand_locks: locks,
});

async function render(browser: Browser, width: number, locks: Record<string, boolean>) {
  const css = await appCss();
  const markup = renderToStaticMarkup(createElement(OfficeBranding as never, { office: office(locks) }));
  const page = await browser.newPage();
  await page.setViewportSize({ width, height: 1600 });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
     <style>body{margin:0;padding:16px;background:#0b0f16}</style></head>
     <body class="sc-app">${markup}</body></html>`,
    { waitUntil: "load" },
  );
  await page.waitForTimeout(150);
  return page;
}

describe("the Branding page's locks", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  it("offers both locks, and reflects the saved state of each", async () => {
    const page = await render(browser, 1100, { template: true, links: true });
    try {
      const state = await page.evaluate(() =>
        [...document.querySelectorAll("label")]
          .filter((l) => /Keep every card matching|Only you can add link buttons/.test(l.textContent ?? ""))
          .map((l) => ({
            label: (l.textContent ?? "").trim().split("\n")[0].trim(),
            checked: (l.querySelector("input") as HTMLInputElement | null)?.checked ?? null,
          })),
      );
      expect(state.length, "both locks must render").toBe(2);
      for (const s of state) expect(s.checked, `"${s.label}" did not reflect the saved ON state`).toBe(true);
    } finally { await page.close(); }
  });

  it("defaults the links lock OFF for an office that never set it", async () => {
    // An existing office must not silently acquire a restriction.
    const page = await render(browser, 1100, { template: true });
    try {
      const checked = await page.evaluate(() => {
        const l = [...document.querySelectorAll("label")].find((x) => /Only you can add link buttons/.test(x.textContent ?? ""));
        return (l?.querySelector("input") as HTMLInputElement | null)?.checked ?? null;
      });
      expect(checked).toBe(false);
    } finally { await page.close(); }
  });

  it("promises nothing is deleted, because nothing is", async () => {
    const page = await render(browser, 1100, { template: true, links: true });
    try {
      const t = await page.innerText("body");
      expect(t).toMatch(/Links already on a card stay/);
      expect(t).toMatch(/nothing is deleted/i);
    } finally { await page.close(); }
  });

  it("no longer overstates what the office controls", async () => {
    // The old list named only name/photo/title/phone/email and said
    // "everything else is what you set here" — which would tell a compliance
    // buyer that socials, bio and links were company-controlled. They are not.
    const page = await render(browser, 1100, { template: true });
    try {
      const t = await page.innerText("body");
      expect(t).toContain("Their social profiles");
      expect(t).toContain("Their bio");
      expect(t).toContain("Their link buttons");
      expect(t).not.toMatch(/everything else is what you set here/);
    } finally { await page.close(); }
  });

  it("moves link buttons to the company column once locked", async () => {
    const on = await render(browser, 1100, { template: true, links: true });
    try {
      const t = await on.innerText("body");
      expect(t).toContain("Link buttons");
      expect(t, "links are still listed as the member's while locked").not.toContain("Their link buttons");
    } finally { await on.close(); }
  });

  for (const width of [390, 1100]) {
    it(`the controls fit at ${width}px`, async () => {
      // Measured on the FORM column only. The aside holds a live card preview
      // that CardScaler shrinks by measuring its container at runtime — that
      // measurement does not happen in a static render, so the card sits at
      // its natural width here and would report a spill that does not exist in
      // the product. The controls are what changed, and they are what this
      // guards.
      const page = await render(browser, width, { template: true, links: true });
      try {
        const res = await page.evaluate(() => {
          const root = document.body.firstElementChild as HTMLElement;
          const form = root.querySelector(":scope > div") as HTMLElement | null;
          if (!form) return { spills: ["form column not found"], limit: 0 };
          const limit = form.getBoundingClientRect().right + 1;
          const spills: string[] = [];
          form.querySelectorAll("*").forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > limit) spills.push(`${el.tagName}.${el.className}`.slice(0, 60));
          });
          return { spills, limit };
        });
        expect(res.spills, `controls spill past their column at ${width}px`).toEqual([]);
      } finally { await page.close(); }
    });
  }

  it("both lock checkboxes are real tap targets", async () => {
    const page = await render(browser, 390, { template: true, links: true });
    try {
      const boxes = await page.evaluate(() =>
        [...document.querySelectorAll("label")]
          .filter((l) => /Keep every card matching|Only you can add link buttons/.test(l.textContent ?? ""))
          .map((l) => ({ h: l.getBoundingClientRect().height, w: l.getBoundingClientRect().width })),
      );
      expect(boxes.length).toBe(2);
      // The whole label is the target, not just the 13px box.
      for (const b of boxes) { expect(b.h).toBeGreaterThanOrEqual(28); expect(b.w).toBeGreaterThan(150); }
    } finally { await page.close(); }
  });
});
