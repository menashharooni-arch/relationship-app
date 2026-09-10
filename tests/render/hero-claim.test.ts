// ── The homepage hero claim pill, measured ───────────────────────────────────
//
// Two defects the owner reported on 2026-09-10, both invisible to a source
// scan because both are computed style:
//
//   1. Typing pushed the field up out of line with "SwiftCard.me/". The cause
//      was globals.css's 16px iOS-zoom floor reaching the <input> and not the
//      <span> beside it, so the two halves of one URL rendered at two sizes and
//      the taller line box won. Only a browser knows what that floor did.
//   2. A hard outline appeared around the pill on focus. The app-wide dark
//      chrome rule is `:is(input, [tabindex]:not([tabindex="-1"]), …)
//      :focus-visible`, which scores (0,3,0) — :is() takes the specificity of
//      its most specific argument — and beat `.sc-claim input:focus-visible`
//      at (0,2,1). Specificity is a cascade outcome; you measure it.
//
// And the reason the field was so narrow in the first place: on a phone every
// pixel of the pill is spoken for, so this also measures that a real full name
// fits rather than scrolling its own first letters out of view.

import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { chromium, type Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { appCss } from "./harness";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace() {}, push() {}, refresh() {} }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const { default: HeroClaim } = await import("@/components/site/HeroClaim");

// The narrow phone still in wide use, the two common modern ones, the big one,
// and a desktop — the pill has different spacing above `sm`, so both regimes
// have to be checked.
const WIDTHS = [
  { name: "iPhone SE / 13 Mini", width: 375, phone: true },
  { name: "iPhone 13", width: 390, phone: true },
  { name: "Pixel 5", width: 393, phone: true },
  { name: "iPhone 14 Pro Max", width: 430, phone: true },
  // A touchscreen ABOVE the `sm` breakpoint. This is the case the first fix
  // missed: portrait phones are all under 640 and desktops have a fine pointer,
  // so nothing exercised "coarse pointer AND sm: applies" — where the unlayered
  // 16px control floor overrode the 17px both halves were asked to render at,
  // but only on the input. An iPad, and any phone turned sideways, live here.
  { name: "iPad (touch)", width: 834, phone: true },
  { name: "phone in landscape", width: 844, phone: true },
  { name: "desktop", width: 1280, phone: false },
];

// The page gutter the hero actually sits in.
const GUTTER = 20;

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

type Probe = {
  spanFs: number;
  inputFs: number;
  topDelta: number;
  heightDelta: number;
  typedShiftTop: number;
  typedShiftHeight: number;
  typedShiftLabelTop: number;
  outlineStyle: string;
  outlineWidth: string;
  restShadow: string;
  focusShadow: string;
  pillInside: boolean;
  docOverflowX: number;
  inputW: number;
  nameNeeds: Record<string, number>;
};

async function probe(width: number, phone: boolean): Promise<Probe> {
  const css = await appCss();
  const html = renderToStaticMarkup(createElement(HeroClaim));
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    hasTouch: phone,
    isMobile: phone,
  });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8">` +
        // Next ships `width=device-width, initial-scale=1`. Without it a
        // mobile-emulated page uses a 980px layout viewport whatever the window
        // says, so every `sm:` utility applies and a 375px row silently
        // measures a tablet.
        `<meta name="viewport" content="width=device-width, initial-scale=1">` +
        `<style>${css}</style></head>` +
        `<body class="sc-app" style="margin:0"><div style="padding:0 ${GUTTER}px">${html}</div></body></html>`,
      { waitUntil: "load" },
    );
    const rest = await page.evaluate((gutter) => {
      const form = document.querySelector("form")!;
      const span = Array.from(form.querySelectorAll("span")).find((s) =>
        s.textContent?.includes("SwiftCard.me/"),
      )!;
      const input = form.querySelector("input")!;
      const cs = getComputedStyle;
      const restShadow = cs(form).boxShadow;

      // Width a given name needs, measured in the input's own font.
      const nameNeeds: Record<string, number> = {};
      const ruler = document.createElement("span");
      const is = cs(input);
      ruler.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${is.fontStyle} ${is.fontWeight} ${is.fontSize}/${is.lineHeight} ${is.fontFamily};letter-spacing:${is.letterSpacing}`;
      document.body.appendChild(ruler);
      for (const n of ["Alex", "Alex Morgan", "Alexandra Morgan"]) {
        ruler.textContent = n;
        nameNeeds[n] = Math.ceil(ruler.getBoundingClientRect().width);
      }
      ruler.remove();

      const fr = form.getBoundingClientRect();
      const sr = span.getBoundingClientRect();
      const ir = input.getBoundingClientRect();

      // Type into it and see whether anything moves.
      input.value = "Alex Morgan";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const ir2 = input.getBoundingClientRect();
      const sr2 = span.getBoundingClientRect();
      return {
        spanFs: parseFloat(cs(span).fontSize),
        inputFs: parseFloat(cs(input).fontSize),
        topDelta: Math.abs(sr.top - ir.top),
        heightDelta: Math.abs(sr.height - ir.height),
        typedShiftTop: Math.abs(ir2.top - ir.top),
        typedShiftHeight: Math.abs(ir2.height - ir.height),
        typedShiftLabelTop: Math.abs(sr2.top - sr.top),
        restShadow,
        pillInside: fr.left >= gutter - 0.5 && fr.right <= innerWidth - gutter + 0.5,
        docOverflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        inputW: Math.round(ir.width),
        nameNeeds,
      };
    }, GUTTER);

    // The ring fades in over 0.18s (.sc-claim has `transition: box-shadow`), so
    // reading the computed value in the same tick as .focus() returns the START
    // of the interpolation — the resting shadow with a transparent ring stapled
    // on. Let it land before believing it.
    await page.focus("#hero-claim-name");
    await page.waitForTimeout(400);
    const focused = await page.evaluate(() => {
      const form = document.querySelector("form")!;
      const input = form.querySelector("input")!;
      const cs = getComputedStyle;
      return {
        focusShadow: cs(form).boxShadow,
        outlineStyle: cs(input).outlineStyle,
        outlineWidth: cs(input).outlineWidth,
      };
    });
    return { ...rest, ...focused };
  } finally {
    await page.close();
  }
}

const probes = new Map<number, Probe>();
beforeAll(async () => {
  for (const w of WIDTHS) probes.set(w.width, await probe(w.width, w.phone));
}, 120_000);

describe("the two halves of the URL render as one line of text", () => {
  it.each(WIDTHS)("$name: same font size on both halves", ({ width }) => {
    const p = probes.get(width)!;
    expect(p.spanFs).toBe(p.inputFs);
  });

  it.each(WIDTHS)("$name: the two boxes start at the same height", ({ width }) => {
    const p = probes.get(width)!;
    expect(p.topDelta).toBeLessThanOrEqual(0.5);
  });

  it.each(WIDTHS)("$name: typing a name moves nothing", ({ width }) => {
    // The reported symptom, reproduced directly: fill the field and re-measure.
    // A size mismatch between the halves shows up here as a shifted box.
    const p = probes.get(width)!;
    expect(p.typedShiftTop).toBeLessThanOrEqual(0.5);
    expect(p.typedShiftHeight).toBeLessThanOrEqual(0.5);
    expect(p.typedShiftLabelTop).toBeLessThanOrEqual(0.5);
  });

  it.each(WIDTHS.filter((w) => w.phone))("$name: stays at or above the 16px iOS zoom floor", ({ width }) => {
    const p = probes.get(width)!;
    expect(p.inputFs).toBeGreaterThanOrEqual(16);
    expect(p.spanFs).toBeGreaterThanOrEqual(16);
  });
});

describe("focus is shown on the pill, never as an outline on the field", () => {
  it.each(WIDTHS)("$name: the field draws no outline of its own", ({ width }) => {
    const p = probes.get(width)!;
    // Either outright none, or a zero-width one — both are invisible.
    const invisible = p.outlineStyle === "none" || parseFloat(p.outlineWidth) === 0;
    expect({ width, outlineStyle: p.outlineStyle, outlineWidth: p.outlineWidth, invisible }).toMatchObject({
      invisible: true,
    });
  });

  it.each(WIDTHS)("$name: the pill takes the brand ring instead", ({ width }) => {
    const p = probes.get(width)!;
    expect(p.focusShadow).not.toBe(p.restShadow);
    expect(p.focusShadow).toContain("rgb(29, 78, 216)");
  });

  it.each(WIDTHS)("$name: the resting shadow survives focus", ({ width }) => {
    const p = probes.get(width)!;
    // The lift shadow is the first layer of both; losing it on focus would make
    // the pill drop flat the instant it is used.
    expect(p.focusShadow.startsWith(p.restShadow.split(",").slice(0, 4).join(","))).toBe(true);
  });
});

describe("the pill fits the screen", () => {
  it.each(WIDTHS)("$name: inside the gutters, no sideways scroll", ({ width }) => {
    const p = probes.get(width)!;
    expect(p.pillInside).toBe(true);
    expect(p.docOverflowX).toBe(0);
  });

  // 390px is the modern-phone floor (iPhone 12/13/14/15/16 all sit at 390+).
  // A two-word full name has to fit there without the field scrolling its own
  // first letters away — that was the owner's screenshot, "SwiftCard.me/lex
  // Morgan". 375 is 12px short of that and is documented, not asserted.
  it.each(WIDTHS.filter((w) => w.width >= 390))("$name: a full name fits the field", ({ width }) => {
    const p = probes.get(width)!;
    expect({ width, inputW: p.inputW, needs: p.nameNeeds["Alex Morgan"] }).toMatchObject({
      inputW: expect.any(Number),
    });
    expect(p.inputW).toBeGreaterThanOrEqual(p.nameNeeds["Alex Morgan"]);
  });
});
