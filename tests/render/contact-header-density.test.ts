// ── The contact header has to fit a phone without shrinking to nothing ───────
//
// Reported from a real iPhone: opening a contact showed the first name on one
// line and the last name on the next, an oversized block under it, and a status
// pill so squeezed you could not read whether it said "New Contact".
//
// Measured at 390px, the cause was budget, not font size. The header is one
// flex row: a 64px avatar, the name/status column, and a "Mark as unread"
// button whose TEXT made it 137px — over a third of the screen — and which is
// shrink-0, so the column absorbed every pixel of the shortfall and collapsed
// to 101px. A two-word name cannot sit on one line in 101px, and the status
// <select> — held at 16px by the iOS form-control floor, so it needs 149px —
// had to render "New Contact" in 101px.
//
// The fix is phone-only: smaller avatar and name, and the button collapses to
// its icon (with an aria-label, since `hidden` removes text from the a11y tree
// as well as the layout). From `sm` up nothing changes at all.
//
// This is a render test because every number above is a function of content
// width x container width x font metrics — none of which exist until something
// is actually laid out. A source scan cannot see any of it.

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

// An ORDINARY two-word name. The hostile unbreakable-token case is covered by
// portal-phone-fit; the bug reported here happens with a perfectly normal one.
const lead = {
  id: "lead-1", name: "Menash Harooni", email: "menash@example.com", phone: "4155550192",
  company: null, company_description: null, location: null, notes: null,
  source: "qr_scan", visitor_id: null, created_at: "2026-08-01T18:00:00.000Z",
  status: "new_contact", tags: [], follow_up_date: null,
  card_owner: "demo-sales", where_met: null, convo_details: null, message: null,
};

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

async function measure(width: number) {
  const { default: ContactsClient } = await import("@/components/ContactsClient");
  const markup = renderToStaticMarkup(createElement(ContactsClient as never, {
    leads: [lead], primaryUsername: "demo-sales",
    userCards: [{ username: "demo-sales", name: "Demo Sales" }], initialSelectedId: "lead-1",
  } as never));
  const css = await appCss();
  const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8">` +
      // REQUIRED. Without it Chromium lays out at ~980px, every `sm:` rule
      // applies, and the phone measurement silently becomes a desktop one —
      // which is exactly how a first pass at this test "proved" a fix that
      // had not taken effect.
      `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` +
      `<style>${css}</style><style>body{margin:0}</style></head>` +
      `<body class="sc-app"><div id="root">${markup}</div></body></html>`,
      { waitUntil: "load" },
    );
    return await page.evaluate(() => {
      const hdr = document.querySelector('[data-tour="contact-detail"]') as HTMLElement;
      const h2 = hdr.querySelector("h2") as HTMLElement;
      const col = h2.parentElement as HTMLElement;
      const btns = Array.from(hdr.querySelectorAll("button")) as HTMLElement[];
      const readBtn = btns[btns.length - 1];
      return {
        nameLines: Math.round(h2.getBoundingClientRect().height / parseFloat(getComputedStyle(h2).lineHeight)),
        nameFont: parseFloat(getComputedStyle(h2).fontSize),
        nameColumnWidth: Math.round(col.getBoundingClientRect().width),
        readBtnWidth: Math.round(readBtn.getBoundingClientRect().width),
        readBtnAria: readBtn.getAttribute("aria-label"),
        readBtnVisibleText: readBtn.innerText.trim(),
        hasStatusSelect: !!hdr.querySelector("select"),
        headerHeight: Math.round(hdr.getBoundingClientRect().height),
      };
    });
  } finally {
    await page.close();
  }
}

describe("on a phone (390px)", () => {
  it("keeps an ordinary name on one line", async () => {
    // Was 2 lines. This is the headline complaint.
    expect((await measure(390)).nameLines).toBe(1);
  }, 120000);

  it("no longer carries a status dropdown", async () => {
    // Removed deliberately. Stopping automations for a contact is done with the
    // per-channel Email/Text switches, which the cron honours via the
    // email-paused / sms-paused tags — the status pill was a second, unlabelled
    // way to do the same thing, and it was the widest thing competing for the
    // name's line. Status itself still exists and is still set from the Office
    // Leads tab; only this editing surface is gone.
    expect((await measure(390)).hasStatusSelect).toBe(false);
  }, 120000);

  it("does not let the read/unread button eat the row", async () => {
    // 137px of a 390px screen went to one button's text label.
    const m = await measure(390);
    expect(m.readBtnWidth).toBeLessThan(50);
    expect(m.readBtnVisibleText).toBe("");
  }, 120000);

  it("still names that button for a screen reader", async () => {
    // `hidden` is display:none — it removes the text from the a11y tree too,
    // so hiding the label without this would leave an unlabelled icon button.
    const m = await measure(390);
    expect(m.readBtnAria).toMatch(/Mark as (read|unread)/);
  }, 120000);

  it("leaves the name column far more room than the button beside it", async () => {
    // Was 101px, squeezed by a 137px button. It is now content-sized rather
    // than a fixed number: removing the status <select> took the widest item
    // out of that row, so the column no longer has to be 254px to hold it. The
    // number that matters is the ratio — the name must dominate the row, not
    // lose it to a control. (The absolute guarantee is the one-line test above.)
    const m = await measure(390);
    expect(m.nameColumnWidth).toBeGreaterThan(m.readBtnWidth * 3);
  }, 120000);

  it("is materially shorter than it was", async () => {
    expect((await measure(390)).headerHeight).toBeLessThan(120); // was 167
  }, 120000);
});

describe("from sm up, nothing changed", () => {
  it("keeps the full-size name and the labelled button", async () => {
    // The phone fix must not cost anything on a tablet or desktop, where there
    // was never a shortage of room.
    const m = await measure(768);
    expect(m.nameFont).toBe(20);
    expect(m.readBtnVisibleText).toMatch(/Mark as (read|unread)/);
    expect(m.readBtnWidth).toBeGreaterThan(100);
  }, 120000);
});
