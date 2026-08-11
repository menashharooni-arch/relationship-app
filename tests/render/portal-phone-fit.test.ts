// ── Portal screens must fit a phone ──────────────────────────────────────────
//
// Reported from a real iPhone: opening a contact from Contacts rendered a page
// that did not fit — the "Contacts" back button at the top left could not be
// reached. Horizontal overflow is invisible to every source scan we have,
// because it is a function of content width x container width x font metrics,
// none of which exist until something is laid out.
//
// So this renders the real component at real phone widths in headless Chromium
// with the app's real compiled CSS, and measures whether anything escapes the
// viewport horizontally. A page that overflows horizontally is the defect: the
// user can pan away from the chrome and, on iOS, cannot always pan back.
//
// Touch emulation is ON because the 16px form-control floor in globals.css only
// applies to touch devices — that floor makes several controls BIGGER, so the
// fit has to be proven under the same conditions the phone will use, not under
// desktop metrics where the controls are smaller and everything trivially fits.
//
// next/navigation is mocked: these are client components that call useRouter at
// render, and there is no router outside the app. Nothing under test depends on
// navigation behaviour — only on layout.

import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { chromium, type Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { appCss } from "./harness";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace() {}, push() {}, refresh() {} }),
  usePathname: () => "/contacts",
  useSearchParams: () => new URLSearchParams(),
}));

// Narrowest phone still in wide use (iPhone SE) and the common modern width.
const WIDTHS = [
  { name: "iPhone SE", width: 375 },
  { name: "iPhone 15", width: 393 },
];

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

/** A contact with realistically hostile values — long name, long email, notes. */
const lead = {
  id: "lead-1",
  name: "Alexandra Constantinopoulos-Fitzgerald",
  email: "alexandra.constantinopoulos@northbeamstudioarchitects.com",
  phone: "4155550192",
  company: "Northbeam Studio Architects & Interior Design",
  company_description: null,
  location: "San Francisco, California",
  notes: "Met at the downtown open house. Wants a follow-up about the Fillmore listing.",
  source: "qr_scan",
  visitor_id: null,
  created_at: "2026-08-01T18:00:00.000Z",
  status: "touch",
  tags: ["hot-lead", "open-house"],
  follow_up_date: null,
  card_owner: "demo-sales",
  where_met: "Downtown open house",
  convo_details: null,
  message: null,
};

/**
 * Lay out markup at a phone width and report what sticks out sideways.
 *
 * documentElement.scrollWidth > clientWidth is the headline: that is exactly the
 * condition that lets a user pan the page sideways. The per-element list exists
 * so a failure names the culprit instead of just asserting a number.
 */
async function measureFit(markup: string, width: number) {
  const css = await appCss();
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` +
        `<style>${css}</style><style>body{margin:0}</style></head>` +
        `<body class="sc-app"><div id="root">${markup}</div></body></html>`,
      { waitUntil: "load" },
    );
    return await page.evaluate(() => {
      const doc = document.documentElement;
      const vw = doc.clientWidth;
      const offenders: { tag: string; cls: string; text: string; right: number }[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("#root *"))) {
        const r = el.getBoundingClientRect();
        // Only report the element itself sticking out, not a parent that is
        // wide merely because a child is — leaf-ish nodes name the real cause.
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 1) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || "").toString().slice(0, 80),
            text: (el.textContent || "").trim().slice(0, 40),
            right: Math.round(r.right),
          });
        }
      }
      return {
        viewportWidth: vw,
        scrollWidth: doc.scrollWidth,
        overflowX: Math.max(0, doc.scrollWidth - vw),
        offenders: offenders.slice(0, 12),
      };
    });
  } finally {
    await page.close();
  }
}

describe("contact detail fits a phone", () => {
  for (const { name, width } of WIDTHS) {
    it(`does not overflow horizontally at ${width}px (${name})`, async () => {
      const { default: ContactsClient } = await import("@/components/ContactsClient");
      const markup = renderToStaticMarkup(
        createElement(ContactsClient, {
          leads: [lead],
          primaryUsername: "demo-sales",
          userCards: [{ username: "demo-sales", name: "Demo Sales" }],
          initialSelectedId: "lead-1",
        }),
      );

      const fit = await measureFit(markup, width);
      expect(
        fit.overflowX,
        `page is ${fit.overflowX}px wider than the ${width}px viewport. ` +
          `Offenders: ${JSON.stringify(fit.offenders, null, 2)}`,
      ).toBe(0);
    });
  }

  it("keeps the back-to-Contacts control inside the viewport", async () => {
    // The specific reported symptom: the back button existed but could not be
    // tapped. A control whose box starts beyond the right edge, or whose left
    // edge is negative, is unreachable no matter how correct the rest is.
    const { default: ContactsClient } = await import("@/components/ContactsClient");
    const markup = renderToStaticMarkup(
      createElement(ContactsClient, {
        leads: [lead],
        primaryUsername: "demo-sales",
        userCards: [{ username: "demo-sales", name: "Demo Sales" }],
        initialSelectedId: "lead-1",
      }),
    );

    const css = await appCss();
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, hasTouch: true, isMobile: true });
    try {
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>` +
          `<style>body{margin:0}</style></head><body class="sc-app">${markup}</body></html>`,
        { waitUntil: "load" },
      );
      const back = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll<HTMLElement>("button, a")).find((b) =>
          (b.textContent || "").trim().startsWith("Contacts"),
        );
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
      });
      expect(back, "no back-to-Contacts control rendered in the detail view").not.toBeNull();
      expect(back!.left).toBeGreaterThanOrEqual(0);
      expect(back!.right).toBeLessThanOrEqual(375);
      expect(back!.width).toBeGreaterThan(0);
    } finally {
      await page.close();
    }
  });
});
