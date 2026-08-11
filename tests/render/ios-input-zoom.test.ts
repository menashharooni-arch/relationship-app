// ── iOS focus auto-zoom: the 16px floor, measured ────────────────────────────
//
// iOS (Safari AND WKWebView) zooms the entire page in when the user focuses a
// form control whose COMPUTED font-size is under 16px. It then does not zoom
// back out. That is what made "Add Contact" unusable on a phone: the field was
// text-sm (14px), iOS zoomed, and the viewport meta at the time carried
// user-scalable=no, so pinching back out was impossible too.
//
// globals.css sets a 16px floor on form controls under `@media (pointer: coarse)`.
// The floor is an ELEMENT selector (specificity 0,0,1) and it has to override
// Tailwind's `text-sm` UTILITY CLASS (0,1,0) — which it loses on specificity and
// wins on cascade LAYER, because Tailwind 4 puts utilities in `@layer utilities`
// and unlayered rules outrank every layered one. That is subtle enough to be
// worth measuring rather than reasoning about: if someone ever wraps globals.css
// in an @layer, the floor silently stops applying and the bug comes back with no
// other symptom. This test is what fails that day.
//
// Measured in a real browser with touch emulation on, because `pointer: coarse`
// is a browser state, not something a source scan can evaluate.

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { appCss } from "./harness";

const IPHONE = { width: 390, height: 844 };

/** Every Tailwind text size that appears on a control in src/, plus bare. */
const SIZE_CLASSES = ["", "text-xs", "text-sm", "text-base", "text-lg"];

const CONTROLS = [
  { tag: "input", attrs: 'type="text"' },
  { tag: "input", attrs: 'type="email"' },
  { tag: "input", attrs: 'type="tel"' },
  { tag: "input", attrs: 'type="search"' },
  { tag: "input", attrs: 'type="password"' },
  { tag: "input", attrs: 'type="number"' },
  { tag: "input", attrs: 'type="date"' },
  { tag: "textarea", attrs: "" },
  { tag: "select", attrs: "" },
];

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

/** Computed font-size of every control on a touch device, in px. */
async function measure(html: string, hasTouch: boolean) {
  const css = await appCss();
  const page = await browser.newPage({ viewport: IPHONE, hasTouch, isMobile: hasTouch });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>` +
        `<body class="sc-app">${html}</body></html>`,
      { waitUntil: "load" },
    );
    return await page.evaluate(() => {
      const out: { label: string; px: number }[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("input, textarea, select"))) {
        out.push({
          label: el.dataset.label ?? el.tagName.toLowerCase(),
          px: parseFloat(getComputedStyle(el).fontSize),
        });
      }
      return out;
    });
  } finally {
    await page.close();
  }
}

describe("iOS focus auto-zoom", () => {
  it("holds every form control at >= 16px on a touch device", async () => {
    const html = CONTROLS.flatMap(({ tag, attrs }) =>
      SIZE_CLASSES.map((cls) => {
        const label = `${tag}${attrs ? `[${attrs.replace(/type=|"/g, "")}]` : ""}.${cls || "bare"}`;
        return tag === "textarea" || tag === "select"
          ? `<${tag} class="${cls}" data-label="${label}"></${tag}>`
          : `<input ${attrs} class="${cls}" data-label="${label}" />`;
      }),
    ).join("");

    const sizes = await measure(html, true);
    expect(sizes.length).toBe(CONTROLS.length * SIZE_CLASSES.length);

    const tooSmall = sizes.filter((s) => s.px < 16);
    expect(
      tooSmall,
      `these controls would make iOS zoom the page in on focus: ${tooSmall
        .map((s) => `${s.label}=${s.px}px`)
        .join(", ")}`,
    ).toEqual([]);
  });

  it("beats Tailwind's text-sm utility specifically", async () => {
    // The whole fix rests on this one override. text-sm is 14px; if the floor
    // ever loses the cascade this reads 14 and the bug is back.
    const sizes = await measure('<input class="text-sm" data-label="text-sm" />', true);
    expect(sizes[0].px).toBeGreaterThanOrEqual(16);
  });

  it("leaves a deliberately LARGER control alone", async () => {
    // The floor is a floor, not a clamp — text-lg (18px) must survive it, or
    // every emphasised field silently shrinks on phones.
    const sizes = await measure('<input class="text-lg" data-label="text-lg" />', true);
    expect(sizes[0].px).toBeGreaterThan(16);
  });

  it("leaves desktop density untouched", async () => {
    // Desktop has no zoom behaviour to defend against, and 14px inputs are the
    // designed density there. A floor that applied everywhere would be a
    // visual regression on every form in the product.
    const sizes = await measure('<input class="text-sm" data-label="text-sm" />', false);
    expect(sizes[0].px).toBeCloseTo(14, 0);
  });
});
