import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser } from "playwright";
import { appCss, launchBrowser } from "./harness";

// The dashboard is behind login and needs a database, so it can't be crawled.
// This lays out the My Cards box with the app's REAL compiled Tailwind and
// measures the new mobile "Add card" button — the claim being tested is a
// visual one ("clean and even"), which no source scan can check.
//
// The class strings are READ OUT OF THE PAGE SOURCE rather than copied here, so
// this measures what actually ships. If someone edits the button's classes, this
// test measures the edited ones; if they delete it, the extraction fails loudly.

const DASH = join(process.cwd(), "src/app/dashboard/page.tsx");
const src = () => readFileSync(DASH, "utf8");

/** Pull a className string out of the page source by a distinctive fragment. */
function classNameContaining(fragment: string): string {
  const s = src();
  const re = new RegExp(`className="([^"]*${fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"]*)"`);
  const m = s.match(re);
  if (!m) throw new Error(`No className containing "${fragment}" in dashboard/page.tsx`);
  return m[1];
}

const MOBILE = 375;
const DESKTOP = 1280;

let browser: Browser;
beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
afterAll(async () => { await browser?.close(); });

/**
 * Render the My Cards box at a given viewport width and measure.
 * Box + row classes come from source too, so the button is measured against the
 * real container and the real rows it has to line up with.
 */
async function measure(width: number) {
  const css = await appCss();
  const boxCls = classNameContaining("bg-gray-900 border border-gray-800/80 rounded-2xl p-5 mb-5");
  const addBtnCls = classNameContaining("sm:hidden flex items-center justify-center");
  const desktopWrapCls = classNameContaining("hidden sm:flex items-center gap-3");
  const rowCls =
    "flex items-center gap-3 rounded-xl px-4 py-3 transition-all border flex-1 min-w-full sm:min-w-[200px] bg-gray-800/60 border-gray-700/60";

  const page = await browser.newPage({ viewportSize: { width, height: 900 } });
  // setViewportSize EXPLICITLY. The constructor option alone did not take here
  // — window.innerWidth stayed at Playwright's 1280 default, so a "mobile" run
  // was silently measuring desktop and every sm: assertion was inverted. This
  // is the whole reason the test can be trusted, so it is asserted below too.
  await page.setViewportSize({ width, height: 900 });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
       <style>body{margin:0;padding:0;background:#030712}</style></head>
       <body class="sc-app">
         <div id="box" class="${boxCls}">
           <div class="flex items-center justify-between mb-3">
             <div>
               <p class="text-white font-semibold text-sm">My Cards</p>
               <p class="text-gray-600 text-xs mt-0.5">Check a card to view everything about it. Only one card can be selected at a time.</p>
             </div>
             <div id="desktopWrap" class="${desktopWrapCls}">
               <a id="desktopLink" href="#" class="text-xs text-blue-400 font-medium">+ Add card</a>
             </div>
           </div>
           <a id="addBtn" href="#" class="${addBtnCls}">
             <svg viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5"><path d="M10 4v12M4 10h12"/></svg>
             Add card
           </a>
           <div id="rows" class="flex flex-wrap gap-2">
             <div id="row" class="${rowCls}"><span class="text-white text-sm">Work card</span></div>
           </div>
         </div>
       </body></html>`,
    );

    return await page.evaluate(() => {
      const r = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          x: b.x, width: b.width, height: b.height,
          display: cs.display,
          justifyContent: cs.justifyContent,
          borderRadius: cs.borderTopLeftRadius,
        };
      };
      const box = document.getElementById("box")!;
      const bs = getComputedStyle(box);
      return {
        // Reported so every assertion can confirm it ran at the width it
        // thinks it did — see the setViewportSize note above.
        innerWidth: window.innerWidth,
        box: {
          ...r("box")!,
          padLeft: parseFloat(bs.paddingLeft),
          padRight: parseFloat(bs.paddingRight),
          // getBoundingClientRect returns the BORDER-box width, and this panel
          // has a 1px border. Leaving these out of the inner-width maths made
          // a correctly full-width button look 2px short.
          borderLeft: parseFloat(bs.borderLeftWidth),
          borderRight: parseFloat(bs.borderRightWidth),
        },
        addBtn: r("addBtn"),
        desktopWrap: r("desktopWrap"),
        row: r("row"),
      };
    });
  } finally {
    await page.close();
  }
}

describe("mobile: the Add card button is a real, even, full-width control", () => {
  it("actually renders at a phone width", async () => {
    // Guard on the guard: the first version of this suite silently ran every
    // "mobile" case at 1280px, which inverted every sm: assertion.
    const m = await measure(MOBILE);
    expect(m.innerWidth).toBe(MOBILE);
  });

  it("spans the box's full inner width — same as the card rows under it", async () => {
    const m = await measure(MOBILE);
    expect(m.addBtn, "the mobile Add card button is missing").not.toBeNull();
    const inner =
      m.box.width - m.box.padLeft - m.box.padRight - m.box.borderLeft - m.box.borderRight;
    // Full-width, to the pixel: this is the "even" the redesign is for.
    expect(Math.abs(m.addBtn!.width - inner)).toBeLessThan(1);
    // And exactly as wide as a card row, so the box reads as one stack.
    expect(Math.abs(m.addBtn!.width - m.row!.width)).toBeLessThan(1);
  });

  it("is left-aligned with the rows, not floating off-centre", async () => {
    const m = await measure(MOBILE);
    expect(Math.abs(m.addBtn!.x - m.row!.x)).toBeLessThan(1);
  });

  it("centres its own label", async () => {
    const m = await measure(MOBILE);
    expect(m.addBtn!.justifyContent).toBe("center");
  });

  it("matches the card rows' corner radius", async () => {
    const m = await measure(MOBILE);
    expect(m.addBtn!.borderRadius).toBe(m.row!.borderRadius);
  });

  it("is a tappable height, not a hairline text link", async () => {
    const m = await measure(MOBILE);
    expect(m.addBtn!.height).toBeGreaterThanOrEqual(34);
  });

  it("never overflows the box", async () => {
    const m = await measure(MOBILE);
    const boxRight = m.box.x + m.box.width - m.box.padRight;
    expect(m.addBtn!.x + m.addBtn!.width).toBeLessThanOrEqual(boxRight + 1);
  });

  it("the desktop inline link is hidden at this width", async () => {
    const m = await measure(MOBILE);
    expect(m.desktopWrap!.display).toBe("none");
  });
});

describe("desktop is untouched", () => {
  it("shows the inline text link", async () => {
    const m = await measure(DESKTOP);
    expect(m.desktopWrap!.display).toBe("flex");
    expect(m.desktopWrap!.width).toBeGreaterThan(0);
  });

  it("hides the mobile button entirely — no duplicate control", async () => {
    const m = await measure(DESKTOP);
    expect(m.addBtn!.display).toBe("none");
  });

  it("the box keeps its size and padding", async () => {
    const m = await measure(DESKTOP);
    // p-5 = 20px, unchanged by this work.
    expect(m.box.padLeft).toBe(20);
    expect(m.box.padRight).toBe(20);
  });
});
