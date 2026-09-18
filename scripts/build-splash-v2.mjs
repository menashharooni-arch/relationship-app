// Build the v2 launch splash (owner, 2026-09-18): the WHOLE screen is the
// logo's own background, and only the logo's main part — the card outline and
// the glowing bolt — sits in the centre. No square, no navy frame around it.
//
//   node scripts/build-splash-v2.mjs            → writes all three outputs
//   node scripts/build-splash-v2.mjs --preview  → also writes preview PNGs to
//                                                 $PREVIEW_DIR for a visual check
//
// Outputs (every one derived from the SHIPPED icon, public/icon-512.png, so the
// splash can never drift from the real mark):
//   1. the MARK — the icon's foreground (card outline + bolt + its glow) on a
//      transparent field, inlined into src/lib/splash/markup-v2.html;
//   2. the iOS launch image — ios/App/App/Assets.xcassets/Splash.imageset,
//      2732x2732: the gradient with the mark at exactly the size and place the
//      animation's first frame draws it, so the handoff is pixel-identical;
//   3. the gradient itself, as CSS stops written into markup-v2.html from the
//      SAME numbers the PNG was painted with.
//
// HOW THE MARK IS EXTRACTED. The icon is a raster: a diagonal blue gradient with
// a soft gloss band, and light artwork on top. For every pixel we estimate the
// background B it would have had (a large-radius blur of the icon with the
// artwork masked out, so the gloss is part of B and drops away), then solve
// P = a·F + (1−a)·B for the artwork's alpha `a` and true colour F. The glow
// around the bolt therefore survives as real soft alpha, and composited over the
// new full-screen gradient it looks exactly like it did inside the icon.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const ICON = "public/icon-512.png";
const V1 = "src/lib/splash/markup.html";
const V2 = "src/lib/splash/markup-v2.html";
const SPLASH_DIR = "ios/App/App/Assets.xcassets/Splash.imageset";
const SIZE = 512;
const R = 106; // the icon's corner radius, measured (of 512) — scripts/build-splash-assets.mjs
const CANVAS = 2732;
const MARK_PX = 560; // the mark's span in the launch canvas (= 20.4978vmax on screen)

// ── The screen's gradient: the icon's own, sampled off the artwork ─────────
// Measured along the icon's diagonal t = (x+y)/(2·512), away from the artwork:
//   t .08 #465aa1 · .28 #3f5392/#3b4a8d · .50 #3d487d/#2f3c73 · .72 #263065 · .92 #1d275a
// The two samples at each t differ by the gloss (top) vs the shade (bottom);
// the stops are their means, so the screen reads as the icon without its gloss.
const STOPS = [
  [0.0, [74, 94, 165]],
  [0.28, [61, 79, 143]],
  [0.5, [54, 66, 120]],
  [0.72, [39, 49, 102]],
  [1.0, [27, 36, 85]],
];
const colorAt = (t) => {
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1], [t1, c1] = STOPS[i];
      const k = (t - t0) / (t1 - t0);
      return c0.map((v, j) => v + (c1[j] - v) * k);
    }
  }
  return STOPS[STOPS.length - 1][1];
};
const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const cssGradient = `linear-gradient(135deg,${STOPS.map(([t, c]) => `${hex(c)} ${+(t * 100).toFixed(2)}%`).join(",")})`;

// ── helpers ────────────────────────────────────────────────────────────────
function roundedInside(x, y) {
  const cx = Math.min(Math.max(x, R), SIZE - R), cy = Math.min(Math.max(y, R), SIZE - R);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= R * R;
}
// Normalised box blur (3 passes ≈ gaussian) of `ch` channels weighted by `w`.
function weightedBlur(img, w, ch, radius) {
  let num = new Float32Array(SIZE * SIZE * ch), den = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    den[i] = w[i];
    for (let c = 0; c < ch; c++) num[i * ch + c] = img[i * ch + c] * w[i];
  }
  const pass = (src, n, horiz) => {
    const out = new Float32Array(src.length);
    for (let a = 0; a < SIZE; a++) {
      for (let c = 0; c < n; c++) {
        let acc = 0;
        const get = (b) => { const x = horiz ? b : a, y = horiz ? a : b; return src[(y * SIZE + x) * n + c]; };
        for (let b = -radius; b <= radius; b++) acc += get(Math.min(SIZE - 1, Math.max(0, b)));
        for (let b = 0; b < SIZE; b++) {
          const x = horiz ? b : a, y = horiz ? a : b;
          out[(y * SIZE + x) * n + c] = acc / (2 * radius + 1);
          acc += get(Math.min(SIZE - 1, b + radius + 1)) - get(Math.max(0, b - radius));
        }
      }
    }
    return out;
  };
  for (let k = 0; k < 3; k++) {
    num = pass(pass(num, ch, true), ch, false);
    den = pass(pass(den, 1, true), 1, false);
  }
  const out = new Float32Array(SIZE * SIZE * ch);
  for (let i = 0; i < SIZE * SIZE; i++) for (let c = 0; c < ch; c++) out[i * ch + c] = num[i * ch + c] / Math.max(den[i], 1e-6);
  return out;
}

// ── 1. extract the mark ────────────────────────────────────────────────────
const { data: raw } = await sharp(ICON).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const img = new Float32Array(raw);
const inside = new Uint8Array(SIZE * SIZE);
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) inside[y * SIZE + x] = roundedInside(x + 0.5, y + 0.5) ? 1 : 0;

// Iterate: background from the non-artwork pixels, artwork = what stands above it.
let fg = new Uint8Array(SIZE * SIZE);
let B;
for (let iter = 0; iter < 3; iter++) {
  const w = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) w[i] = inside[i] && !fg[i] ? 1 : 0;
  B = weightedBlur(img, w, 3, 18);
  // artwork = clearly brighter than its background; dilated so its soft edge
  // never leaks into the background estimate
  const hard = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (!inside[i]) continue;
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, img[i * 3 + c] - B[i * 3 + c]);
    hard[i] = d > 14 ? 1 : 0;
  }
  fg = new Uint8Array(SIZE * SIZE);
  const D = 7;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!hard[y * SIZE + x]) continue;
    for (let dy = -D; dy <= D; dy++) for (let dx = -D; dx <= D; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < SIZE && yy < SIZE && dx * dx + dy * dy <= D * D) fg[yy * SIZE + xx] = 1;
    }
  }
}

const FLOOR = 0.035; // below this is gloss/noise, not artwork
const mark = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
  const i = y * SIZE + x;
  // 4px clear of the rounded edge: nothing of the old square may survive
  const edgeSafe = roundedInside(x + 0.5 - 4 * Math.sign(x - 256), y + 0.5 - 4 * Math.sign(y - 256)) && inside[i];
  // Only the artwork (and its glow) — never a stray trace of the gloss band,
  // which otherwise survived as a faint arc along the top edge.
  if (!edgeSafe || !fg[i]) continue;
  let a = 0;
  for (let c = 0; c < 3; c++) {
    const b = B[i * 3 + c];
    a = Math.max(a, (img[i * 3 + c] - b) / Math.max(1, 255 - b));
  }
  a = Math.min(1, Math.max(0, (a - FLOOR) / (1 - FLOOR)));
  if (a <= 0) continue;
  for (let c = 0; c < 3; c++) {
    const b = B[i * 3 + c];
    mark[i * 4 + c] = Math.round(Math.min(255, Math.max(0, b + (img[i * 3 + c] - b) / a)));
  }
  mark[i * 4 + 3] = Math.round(a * 255);
}
const markPng = await sharp(mark, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer();
// Inlined at the launch image's own mark resolution (560): a Pro Max draws the
// mark at ~570 device px, and a smaller copy softened visibly at the handoff.
const markWebp = await sharp(markPng).resize(MARK_PX, MARK_PX).webp({ quality: 92, alphaQuality: 100 }).toBuffer();

// ── 2. the iOS launch image: gradient + mark ───────────────────────────────
const bg = Buffer.alloc(CANVAS * CANVAS * 3);
for (let y = 0; y < CANVAS; y++) for (let x = 0; x < CANVAS; x++) {
  // CSS linear-gradient(135deg) across a square: t = (x+y)/(2·S), pixel centres
  const t = (x + 0.5 + y + 0.5) / (2 * CANVAS);
  const c = colorAt(t);
  const i = (y * CANVAS + x) * 3;
  // No dither: the steepest channel moves ~80 levels across the whole diagonal,
  // a 1-level step every ~15pt on a phone, which is invisible — and dithering
  // made the asset 5.4MB (x3 copies in the bundle) instead of a few hundred KB.
  // The CSS gradient on frame 0 is undithered too, so the two match.
  for (let j = 0; j < 3; j++) bg[i + j] = Math.round(c[j]);
}
const markAtCanvas = await sharp(markPng).resize(MARK_PX, MARK_PX).png().toBuffer();
const off = Math.round((CANVAS - MARK_PX) / 2);
const splash = await sharp(bg, { raw: { width: CANVAS, height: CANVAS, channels: 3 } })
  .composite([{ input: markAtCanvas, left: off, top: off }])
  .png({ compressionLevel: 9 })
  .toBuffer();
for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  writeFileSync(`${SPLASH_DIR}/${f}`, splash);
}

// ── 2b. a SMOOTH bolt for the aperture ──────────────────────────────────────
// The opening is the logo's own bolt, used as a mask that grows to ~20x the
// mark. v1's mask was the 512px icon's near-white pixels, so at full size its
// edges stair-stepped visibly during the last quarter-second. Same silhouette,
// rebuilt at 3x: upscaled, softened, then re-cut with an antialiased edge.
const BOLT = 1536;
const { data: iconRaw, info: iconInfo } = await sharp(ICON).raw().toBuffer({ resolveWithObject: true });
const hard = Buffer.alloc(SIZE * SIZE);
for (let i = 0, p = 0; i < iconRaw.length; i += iconInfo.channels, p++) {
  hard[p] = iconRaw[i] > 232 && iconRaw[i + 1] > 238 && iconRaw[i + 2] > 240 ? 255 : 0;
}
const soft = await sharp(hard, { raw: { width: SIZE, height: SIZE, channels: 1 } })
  .resize(BOLT, BOLT, { kernel: "lanczos3" })
  // sigma 6 at 3x = 2px of the source: flattens the source's one-pixel stair
  // steps to ~1% of their height, which is what reads as a wavy edge at 20x.
  .blur(6)
  // sharp widens a 1-channel input to sRGB on the way through; read one band
  // back, or the buffer is 3x too long and the bolt comes out sheared.
  .extractChannel(0)
  .raw()
  .toBuffer();
const boltRgba = Buffer.alloc(BOLT * BOLT * 4, 255);
for (let p = 0; p < BOLT * BOLT; p++) {
  const v = soft[p] / 255;
  const k = Math.min(1, Math.max(0, (v - 0.4) / 0.2)); // re-cut at 0.5: edge stays put, ~3px antialiased
  boltRgba[p * 4 + 3] = Math.round(k * k * (3 - 2 * k) * 255);
}
const boltWebp = await sharp(boltRgba, { raw: { width: BOLT, height: BOLT, channels: 4 } })
  .webp({ quality: 90, alphaQuality: 100 })
  .toBuffer();

// ── 3. markup-v2: v1's animation, on the gradient, with the bare mark ──────
let html = readFileSync(V1, "utf8");
const markUri = `data:image/webp;base64,${markWebp.toString("base64")}`;
html = html.replace(/(<img class="vfk-icon" src=")data:image\/webp;base64,[^"]+(")/, `$1${markUri}$2`);
html = html.replace(/(\.vfk-plane\{\s*inset:0;\s*)background:#1A2342;/, `$1background:${cssGradient} 50% 50% / 100vmax 100vmax no-repeat,#364278;`);
if (!html.includes(cssGradient)) throw new Error("plane background not replaced");
// The HOLD frame (before the native launch image is dropped) is painted by the
// root, not the plane — a CSS gradient needs no decode, so it is on screen from
// the first frame. It must be the same gradient, or frame 0 flashes navy.
const hold = "html.sc-splash-hold #sc-splash-vfork{ background:#1A2342; }";
if (!html.includes(hold)) throw new Error("hold background not found");
html = html.replace(hold, `html.sc-splash-hold #sc-splash-vfork{ background:${cssGradient} 50% 50% / 100vmax 100vmax no-repeat,#364278; }`);
// Keep the prose truthful about what frame 0 is now.
html = html.replace("Hands off from the static iOS launch image (#1A2342 + the logo at 20.351vmax, centred)", "Hands off from the static iOS launch image (the logo's gradient, full screen, with its mark at 20.4978vmax, centred)");
html = html.replace("<!-- navy ground. Flat #1A2342 = the launch image. Later it gets a bolt-shaped hole punched through it. -->", "<!-- the ground: the logo's own gradient, full screen = the launch image (v2, 2026-09-18). Later it gets a bolt-shaped hole punched through it. -->");
html = html.replace("<!-- THE REAL APP ICON. Never redrawn, never recoloured, never filtered. Scale + opacity only. -->", "<!-- THE LOGO'S MARK: the real icon's card outline + bolt, lifted off its square (scripts/build-splash-v2.mjs). Scale + opacity only. -->");
if (!html.includes(markUri)) throw new Error("mark not replaced");
// Every use of the bolt mask (the plane's hole and the light inside it, each
// with -webkit- and standard properties) takes the smooth 3x bolt.
const boltUri = `url("data:image/webp;base64,${boltWebp.toString("base64")}")`;
const maskCount = (html.match(/url\("data:image\/webp;base64,[^"]+"\)/g) ?? []).length;
if (maskCount !== 4) throw new Error(`expected 4 bolt mask uses, found ${maskCount}`);
// Stored ONCE as a custom property on the root and referenced four times:
// four inline copies cost ~25KB of launch payload for nothing. The handoff
// script pre-decodes masks through getComputedStyle, which resolves var().
html = html.replace(/url\("data:image\/webp;base64,[^"]+"\)/g, () => "var(--vfk-bolt)");
const markVar = "  --vfk-mark: 20.4978vmax;";
if (!html.includes(markVar)) throw new Error("--vfk-mark not found");
html = html.replace(markVar, `${markVar}\n  --vfk-bolt: ${boltUri};`);
writeFileSync(V2, html);

if (process.argv.includes("--preview")) {
  const dir = process.env.PREVIEW_DIR || ".";
  mkdirSync(dir, { recursive: true });
  // A phone-shaped crop of the launch image (aspect-fill), and the mark alone on black/white.
  const [W, H] = [390, 844];
  const scale = Math.max(W, H) / CANVAS;
  const full = await sharp(splash).resize(Math.round(CANVAS * scale)).toBuffer();
  const left = Math.round((CANVAS * scale - W) / 2);
  await sharp(full).extract({ left, top: 0, width: W, height: H }).png().toFile(`${dir}/launch-iphone14.png`);
  await sharp(markPng).flatten({ background: "#000" }).png().toFile(`${dir}/mark-on-black.png`);
  await sharp(markPng).flatten({ background: "#fff" }).png().toFile(`${dir}/mark-on-white.png`);
}
console.log("gradient:", cssGradient);
console.log("mark webp bytes:", markWebp.length, "| launch png bytes:", splash.length);
