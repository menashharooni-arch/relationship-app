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

/**
 * A contact with realistically hostile values.
 *
 * The name is a single UNBREAKABLE token on purpose. Lead capture accepts an
 * email address in the name field, and that is the real-world shape that
 * breaks: `min-w-0` lets a flex item shrink, but nothing lets a string without
 * a space or hyphen wrap. A hyphenated name would wrap and prove nothing.
 */
const lead = {
  id: "lead-1",
  name: "jennifer.rodriguez@northshorepropertiesgroup.com",
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
async function measureFit(markup: string, width: number, revealTabs = false) {
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
    if (revealTabs) {
      // The detail view keeps BOTH tabs in the DOM and hides the inactive one
      // with `hidden` (display:none). A hidden subtree has no geometry, so its
      // content is invisible to any measurement — the Contact-info fields, which
      // hold the longest values on the screen (email, company, location), would
      // never be checked. Un-hiding is faithful: this is the exact markup the
      // user sees the moment they tap the tab.
      await page.evaluate(() => {
        for (const el of Array.from(document.querySelectorAll(".hidden"))) {
          el.classList.remove("hidden");
        }
      });
    }

    return await page.evaluate(() => {
      const doc = document.documentElement;
      const vw = doc.clientWidth;

      // Measuring document.scrollWidth ALONE is a trap here, and it is the
      // reason an earlier version of this test passed on a screen the user was
      // reporting as broken. The contact detail is `fixed inset-0 …
      // overflow-y-auto`, and per CSS Overflow §3 an element with overflow-y
      // set and overflow-x visible computes overflow-x to `auto`. So the panel
      // is its OWN horizontal scroll container: content overflowing inside it
      // scrolls the panel and never widens the document. The page looks fine
      // and the phone still pans sideways.
      //
      // So: check every element that can scroll itself, plus the document.
      // Only containers the USER can actually pan count. `truncate` sets
      // overflow:hidden and reports scrollWidth > clientWidth by design — that
      // is an ellipsis doing its job, not content escaping, and it neither
      // scrolls nor widens an ancestor. Counting it would fail this test on
      // every well-behaved truncated label in the app.
      const scrollers: { cls: string; overflowX: number }[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
        const over = el.scrollWidth - el.clientWidth;
        if (over <= 1 || el.clientWidth === 0) continue;
        const ox = getComputedStyle(el).overflowX;
        if (ox === "auto" || ox === "scroll") {
          scrollers.push({ cls: (el.className || "").toString().slice(0, 90), overflowX: over });
        }
      }

      const offenders: { tag: string; cls: string; text: string; right: number }[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("#root *"))) {
        const r = el.getBoundingClientRect();
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
        // The worst horizontal overflow anywhere: document or any inner scroller.
        overflowX: Math.max(
          0,
          doc.scrollWidth - vw,
          ...scrollers.map((s) => s.overflowX),
        ),
        scrollers: scrollers.slice(0, 8),
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
        `content is ${fit.overflowX}px wider than the ${width}px viewport.\n` +
          `Scrollers: ${JSON.stringify(fit.scrollers, null, 2)}\n` +
          `Offenders: ${JSON.stringify(fit.offenders, null, 2)}`,
      ).toBe(0);
    });
  }

  it("fits with the Contact-info tab revealed too", async () => {
    // The info tab holds the longest strings on the screen — a full email, a
    // company name, a location — each in a flex row beside a shrink-0 icon.
    // Measuring only the default conversation tab would leave all of it unseen.
    const { default: ContactsClient } = await import("@/components/ContactsClient");
    const markup = renderToStaticMarkup(
      createElement(ContactsClient, {
        leads: [lead],
        primaryUsername: "demo-sales",
        userCards: [{ username: "demo-sales", name: "Demo Sales" }],
        initialSelectedId: "lead-1",
      }),
    );

    const fit = await measureFit(markup, 375, true);
    expect(
      fit.overflowX,
      `contact info overflows by ${fit.overflowX}px at 375px.\n` +
        `Scrollers: ${JSON.stringify(fit.scrollers, null, 2)}\n` +
        `Offenders: ${JSON.stringify(fit.offenders, null, 2)}`,
    ).toBe(0);
  });

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
