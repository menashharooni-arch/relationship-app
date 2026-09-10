// ── Tile labels, measured off real pixels ───────────────────────────────────
//
// The companion unit test (tests/swiftlink-fallback-tile.test.ts) does this
// arithmetically, and arithmetic needs an assumption: how strong the scrim is
// at the exact height the label sits. That assumption was wrong the first time
// — it modelled the scrim at 0.68 when the label actually sits where the ramp
// has only reached about 0.44 — so the fast test was checking a surface that
// does not exist. It happened to be the pessimistic direction, but it could
// just as easily have gone the other way and passed a tile nobody could read.
//
// This one does not model anything. It renders the tile exactly as both the
// live page and the marketing mirror draw it, hides the label, screenshots the
// pixel the label's centre lands on, and measures that. 26 Looks x 4 tiles.

import { it, expect, vi } from "vitest";
import { chromium } from "playwright";
import sharp from "sharp";
import { SWIFTLINK_LOOKS, fallbackTile } from "@/lib/swiftlink-looks";
import { appCss } from "./harness";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const lum = (r: number, g: number, b: number) =>
  [r, g, b].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); })
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: number, b: number) => { const [x, y] = [a, b].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

it("every Look x tile keeps its label above AA on the real composited surface", async () => {
  const css = await appCss();
  // Recreate the tile exactly as both renderers draw it.
  const tile = (look: typeof SWIFTLINK_LOOKS[number], i: number) => {
    const fb = fallbackTile(look, i);
    return `<div style="position:relative;overflow:hidden;border-radius:14px;width:170px;aspect-ratio:1.91/1;background:${look.tile}" data-t="${look.id}-${i}" data-light="${fb.light}">
      <div style="position:absolute;inset:0;background:${fb.background}"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:70%;background:${fb.light
        ? "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.82) 100%)"
        : "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%)"}"></div>
      <span data-label style="position:absolute;left:0;right:0;bottom:7px;display:flex;justify-content:center;z-index:6">
        <span style="font-weight:600;font-size:1rem;line-height:1.3;color:${fb.light ? "#0F172A" : "#ffffff"}">Client reviews</span>
      </span></div>`;
  };
  const html = SWIFTLINK_LOOKS.map((l) => `<div style="display:flex;gap:8px;margin:8px">${[0,1,2,3].map((i) => tile(l, i)).join("")}</div>`).join("");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 760, height: 400 }, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body class="sc-app" style="margin:0;background:#888">${html}</body></html>`, { waitUntil: "load" });

  const spots = await p.evaluate(() => {
    const out: { id: string; light: boolean; ink: string; x: number; y: number }[] = [];
    for (const t of document.querySelectorAll("[data-t]")) {
      const lbl = t.querySelector("[data-label] span")!;
      const r = lbl.getBoundingClientRect();
      out.push({ id: (t as HTMLElement).dataset.t!, light: (t as HTMLElement).dataset.light === "true",
        ink: getComputedStyle(lbl).color, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
    }
    return out;
  });

  // Hide the labels so we sample the SURFACE they sit on, not the glyphs.
  await p.evaluate(() => { for (const s of document.querySelectorAll("[data-label]")) (s as HTMLElement).style.visibility = "hidden"; });
  const buf = await p.screenshot({ fullPage: true });
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const rows: { id: string; c: number }[] = [];
  for (const s of spots) {
    const idx = (s.y * info.width + s.x) * info.channels;
    const surface = lum(data[idx], data[idx + 1], data[idx + 2]);
    const m = s.ink.match(/\d+/g)!.map(Number);
    rows.push({ id: s.id, c: +contrast(lum(m[0], m[1], m[2]), surface).toFixed(2) });
  }
  await b.close();

  rows.sort((a, b2) => a.c - b2.c);
  // Every tile of every Look, not a sample.
  expect(rows).toHaveLength(SWIFTLINK_LOOKS.length * 4);
  // Name the offenders in the failure message rather than just a number.
  expect(rows.filter((r) => r.c < 4.5)).toEqual([]);
  // The measured floor sits far above AA; this catches a drift long before it
  // becomes a readability bug.
  expect(rows[0].c).toBeGreaterThanOrEqual(6);
}, 180000);
