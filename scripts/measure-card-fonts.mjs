// Measure per-character advance widths for every typeface a card can use.
//
// The width tables in src/components/card-templates/shared.tsx (W_UPPER,
// W_MIXED, PHONE_W) are Arial/Helvetica figures, and every fit constant derived
// from them was calibrated in that face. Owners pick from CARD_FONT_OPTIONS, so
// a card can render in Georgia, Courier New or Trebuchet MS — where the same
// string is up to 42% wider. This script is how those differences get measured
// rather than guessed.
//
//   node scripts/measure-card-fonts.mjs
//
// Method (the one shared.tsx documents): render one character repeated ten
// times at font-size 100 and divide the rendered width by 1000.
//
// Run it from the repo root so `playwright` resolves.
import { chromium } from "playwright";

const FONTS = {
  // Keep in sync with CARD_BASE_FONT and CARD_FONT_OPTIONS in
  // src/lib/template-style.ts.
  default: "Arial, Helvetica, sans-serif",
  sans: "var(--font-geist-sans), system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', ui-monospace, monospace",
  rounded: "'Trebuchet MS', system-ui, sans-serif",
};

const PHONE_CHARS = "0123456789()+-. ,ext";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MIXED = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><body><span id=s></span></body>");

const measure = (stack, chars, weight) =>
  page.evaluate(
    ({ stack, chars, weight }) => {
      const s = document.getElementById("s");
      s.style.cssText = `font-family:${stack};font-size:100px;font-weight:${weight};white-space:pre;position:absolute`;
      const r = {};
      for (const ch of chars) {
        s.textContent = ch.repeat(10);
        r[ch] = +(s.getBoundingClientRect().width / 1000).toFixed(4);
      }
      return r;
    },
    { stack, chars, weight },
  );

const out = {};
for (const [name, stack] of Object.entries(FONTS)) {
  out[name] = {
    phone700: await measure(stack, PHONE_CHARS, 700),
    upper400: await measure(stack, UPPER, 400),
    mixed400: await measure(stack, MIXED, 400),
  };
}
await browser.close();

const line = (o) => Object.entries(o).map(([c, w]) => `${JSON.stringify(c)}:${w}`).join(" ");
for (const f of Object.keys(FONTS)) {
  console.log(`\n── ${f} ──`);
  console.log(`  phone700: ${line(out[f].phone700)}`);
}

// What the tables in shared.tsx actually need: how much wider each face runs
// than the Arial figures they hold, for the kinds of string each is used on.
const emOf = (t, s, fallback) => [...s].reduce((a, c) => a + (t[c] ?? fallback), 0);
const SAMPLES = {
  "phone (14ch)": ["phone700", "(415) 555-0188"],
  "phone (ext)": ["phone700", "+1 (512) 555-0147 ext. 8891"],
  "label MOBILE": ["upper400", "MOBILE"],
  "company mixed": ["mixed400", "Northwind Commercial Real Estate Advisors International"],
  "company word": ["mixed400", "Konstantinopoulos"],
  "company UPPER": ["upper400", "NORTHWIND COMMERCIAL REAL ESTATE"],
};
console.log("\n══ WIDTH RELATIVE TO ARIAL (the factor shared.tsx needs) ══");
console.log(`  ${"sample".padEnd(16)}${Object.keys(FONTS).map((f) => f.padStart(9)).join("")}`);
for (const [label, [bucket, s]] of Object.entries(SAMPLES)) {
  const base = emOf(out.default[bucket], s, 0.6);
  const cols = Object.keys(FONTS)
    .map((f) => (emOf(out[f][bucket], s, 0.6) / base).toFixed(3).padStart(9))
    .join("");
  console.log(`  ${label.padEnd(16)}${cols}`);
}
