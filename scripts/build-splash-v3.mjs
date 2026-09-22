// Build the v3 launch splash (owner, 2026-09-20) — the screen in the owner's
// reference image: a deeper blue field with a soft curved sheen across the top,
// and the logo's mark, bigger and brighter, in the middle.
//
//   node scripts/build-splash-v3.mjs            → writes all three outputs
//   node scripts/build-splash-v3.mjs --preview  → also writes preview PNGs to
//                                                 $PREVIEW_DIR for a visual check
//
// EVERY NUMBER HERE WAS MEASURED OFF THE REFERENCE IMAGE (804x1600) and is
// written in ITS pixels, so each one can be checked against it directly:
//
//   field    a linear gradient fitted by least squares in the SQUARE canvas the
//            iOS launch image uses — 146.5°, #2c489f → #111b49, RMS error
//            1.6/255 across the screen away from the mark. (v2: 135°, lighter.)
//   sheen    the curved edge across the top is a circle fitted to the
//            strongest-gradient row of every column in the top third: centre
//            (0.1146, −1.1288) of the canvas, radius 1.3516. Inside it the
//            field is ~6/255 brighter — a 3% white veil with a soft edge.
//   card     x 257→547, y 707→861 · 7px stroke · 19px outer corner radius
//   lines    three, 7px, round caps, at y 732.5 / 761 / 790
//   bolt     its contour traced at lum>225 and simplified to 7 points
//   alpha    outline 0.90, lines 0.55, bolt solid — each implied by the
//            reference's own pixels over its own background
//
// WHY THE MARK IS DRAWN AND NOT LIFTED OUT OF THE APP ICON. v1 and v2 both
// extracted it from public/icon-512.png so the splash could never drift from
// the shipped mark. Measured side by side, the icon's bolt is fatter and
// shorter than the reference's, and its card outline fades down the right
// side; at launch-screen size both are obvious. The reference image is the
// source of truth for the SPLASH, and it is reproduced as vector artwork so it
// stays crisp at every size. The app icon itself is untouched.
//
// Outputs:
//   1. the MARK — artwork + the bolt's halo, inlined into markup-v3.html;
//   2. the iOS launch image — ios/App/App/Assets.xcassets/Splash.imageset,
//      2732x2732: the field with the mark at exactly the size and place the
//      animation's first frame draws it, so the handoff is pixel-identical;
//   3. the field as CSS, and the bolt as the aperture's mask, both written into
//      markup-v3.html from the SAME numbers the PNG was painted with.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const V2 = "src/lib/splash/markup-v2.html";
const V3 = "src/lib/splash/markup-v3.html";
const SPLASH_DIR = "ios/App/App/Assets.xcassets/Splash.imageset";
const CANVAS = 2732;

// ── the field ──────────────────────────────────────────────────────────────
const ANGLE_DEG = 146.5;
const FIELD_FROM = [44, 72, 159];  // #2c489f
const FIELD_TO = [17, 27, 73];     // #111b49
const SHEEN = { cx: 0.1146, cy: -1.1288, r: 1.3516, alpha: 0.03, soft: 0.019 };

// ── the mark ───────────────────────────────────────────────────────────────
// The reference's card spans 290 of its 804px width, on a 1600px-tall screen,
// so the card is 18.125vmax. The square canvas below is 450 reference px around
// the mark's centre — the card is 290 of those 450 — which is what turns that
// measurement into the mark's own box on screen.
const REF = { cx: 402, cy: 774.5, side: 450 };
const CARD_VMAX = (290 / 1600) * 100;
const MARK_VMAX = +(CARD_VMAX * (REF.side / 290)).toFixed(4);
const MARK_PX = Math.round((MARK_VMAX / 100) * CANVAS);
// Stroke-centred geometry: an SVG stroke straddles its path and the
// measurements are of the painted edges, so each inset is half a stroke.
const CARD = { x: 260.5, y: 710.5, w: 283, h: 147, r: 15.5, stroke: 7, alpha: 0.9 };
const LINES = [[279.5, 732.5, 339.5], [278.5, 761, 301.5], [278.5, 790, 308.5]];
const LINE_ALPHA = 0.55;
const BOLT_PATH = "M429 646 L404 768 L450 769 L446 778 L376 904 L402 785 L355 784 Z";
const WHITE = "#fafeff";
// The reference glows blue around the bolt: measured up its axis, the field
// lifts to #466ec6 about 90px out, which is this colour at roughly half.
// `sigma` is in REFERENCE pixels, like every other measurement here, and is
// converted to the raster below — a blur radius quoted in the output's own
// pixels would change meaning the moment the mark is rendered at another size.
// TWO PASSES, FITTED TO THE REFERENCE'S OWN FALLOFF. Walking outward from the
// bolt's edge in the reference, the glow's alpha over the field measures
// 0.80 at 2px, 0.55 at 10, 0.40 at 18, 0.23 at 26, 0.14 at 34, and nothing by
// 74. A single blur cannot be that bright at the edge AND reach that far; two
// fit it to within 0.02 everywhere (least squares over those ten samples).
// Both sigmas are in REFERENCE pixels and are converted to the raster below,
// since a radius in output pixels would change meaning with the mark's size.
const GLOW_LAYERS = [
  { sigma: 35, strength: 0.75, color: [110, 160, 255] },
  { sigma: 16, strength: 1.5, color: [110, 160, 255] },
];
// The aperture's mask is the same bolt at 3x, so its edge stays smooth when the
// hole grows to ~20x the mark (v2 learned that with a 512px mask).
const MASK_PX = 1536;

const hex = (c) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// CSS's own gradient-line maths, so the painted PNG and the CSS agree pixel for
// pixel: t = ((x−cx)·sinθ − (y−cy)·cosθ)/L + 0.5, L = S·(|sinθ|+|cosθ|).
const TH = (ANGLE_DEG * Math.PI) / 180;
const SIN = Math.sin(TH), COS = Math.cos(TH);
const fieldT = (x, y, S) => (((x - S / 2) * SIN - (y - S / 2) * COS) / (S * (Math.abs(SIN) + Math.abs(COS)))) + 0.5;
/** The sheen's white alpha at a point, smooth-stepped across its edge. */
const sheenA = (x, y, S) => {
  const d = Math.hypot(x - SHEEN.cx * S, y - SHEEN.cy * S) / S;
  const k = Math.min(1, Math.max(0, (SHEEN.r + SHEEN.soft - d) / (2 * SHEEN.soft)));
  return SHEEN.alpha * (k * k * (3 - 2 * k));
};

const cssField =
  `radial-gradient(${((SHEEN.r + SHEEN.soft) * 100).toFixed(2)}vmax ${((SHEEN.r + SHEEN.soft) * 100).toFixed(2)}vmax at ${(SHEEN.cx * 100).toFixed(2)}% ${(SHEEN.cy * 100).toFixed(2)}%,` +
  `rgba(255,255,255,${SHEEN.alpha}) 0%,rgba(255,255,255,${SHEEN.alpha}) ${(((SHEEN.r - SHEEN.soft) / (SHEEN.r + SHEEN.soft)) * 100).toFixed(2)}%,rgba(255,255,255,0) 100%),` +
  `linear-gradient(${ANGLE_DEG}deg,${hex(FIELD_FROM)} 0%,${hex(FIELD_TO)} 100%)`;
const cssFieldFull = `${cssField} 50% 50% / 100vmax 100vmax no-repeat,${hex(mix(FIELD_FROM, FIELD_TO, 0.5))}`;

// ── 1. the artwork, drawn, with the bolt's halo under it ───────────────────
const viewBox = `${REF.cx - REF.side / 2} ${REF.cy - REF.side / 2} ${REF.side} ${REF.side}`;
const lineSvg = LINES.map(([x1, y, x2]) =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${WHITE}" stroke-opacity="${LINE_ALPHA}" stroke-width="${CARD.stroke}" stroke-linecap="round"/>`).join("");
const svgMark =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${MARK_PX}" height="${MARK_PX}">` +
  `<rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="${CARD.r}" ry="${CARD.r}" fill="none" stroke="${WHITE}" stroke-opacity="${CARD.alpha}" stroke-width="${CARD.stroke}"/>` +
  lineSvg +
  `<path d="${BOLT_PATH}" fill="#ffffff"/></svg>`;
const svgBolt = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}"><path d="${BOLT_PATH}" fill="#ffffff"/></svg>`;

const artwork = await sharp(Buffer.from(svgMark)).png().toBuffer();
// The halo is the bolt itself, blurred — the same shape, so it can never sit
// off the bolt it belongs to. It goes UNDER the artwork inside the mark image,
// so the launch PNG and the animation's <img> carry the identical glow.
const glowRgba = new Float32Array(MARK_PX * MARK_PX * 4);
for (const layer of GLOW_LAYERS) {
  const blurred = await sharp(Buffer.from(svgBolt(MARK_PX))).ensureAlpha().extractChannel(3)
    .blur(layer.sigma * (MARK_PX / REF.side)).raw().toBuffer();
  for (let i = 0; i < MARK_PX * MARK_PX; i++) {
    const a = Math.min(1, (blurred[i] / 255) * layer.strength);
    if (a <= 0) continue;
    // source-over, in straight alpha: each pass lies on top of the last.
    const dst = glowRgba[i * 4 + 3];
    const out = a + dst * (1 - a);
    for (let c = 0; c < 3; c++) {
      glowRgba[i * 4 + c] = (layer.color[c] * a + glowRgba[i * 4 + c] * dst * (1 - a)) / out;
    }
    glowRgba[i * 4 + 3] = out;
  }
}
const glow = Buffer.alloc(MARK_PX * MARK_PX * 4);
for (let i = 0; i < MARK_PX * MARK_PX * 4; i++) glow[i] = Math.round(i % 4 === 3 ? glowRgba[i] * 255 : glowRgba[i]);
const markPng = await sharp(glow, { raw: { width: MARK_PX, height: MARK_PX, channels: 4 } })
  .composite([{ input: artwork }]).png().toBuffer();
const markWebp = await sharp(markPng).webp({ quality: 95, alphaQuality: 100 }).toBuffer();
// The aperture's mask: the bolt alone, white on transparent, at 3x.
const boltWebp = await sharp(Buffer.from(svgBolt(MASK_PX))).webp({ quality: 90, alphaQuality: 100 }).toBuffer();

// ── 2. the iOS launch image: the field + the mark ──────────────────────────
const bg = Buffer.alloc(CANVAS * CANVAS * 3);
for (let y = 0; y < CANVAS; y++) for (let x = 0; x < CANVAS; x++) {
  const base = mix(FIELD_FROM, FIELD_TO, Math.min(1, Math.max(0, fieldT(x + 0.5, y + 0.5, CANVAS))));
  const a = sheenA(x + 0.5, y + 0.5, CANVAS);
  const i = (y * CANVAS + x) * 3;
  for (let j = 0; j < 3; j++) bg[i + j] = Math.round(base[j] * (1 - a) + 255 * a);
}
const off = Math.round((CANVAS - MARK_PX) / 2);
const splash = await sharp(bg, { raw: { width: CANVAS, height: CANVAS, channels: 3 } })
  .composite([{ input: markPng, left: off, top: off }])
  .png({ compressionLevel: 9 })
  .toBuffer();
for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  writeFileSync(`${SPLASH_DIR}/${f}`, splash);
}

// ── 3. markup-v3: v2's animation, on the new field, with the new mark ──────
let html = readFileSync(V2, "utf8");

const markUri = `data:image/webp;base64,${markWebp.toString("base64")}`;
html = html.replace(/(<img class="vfk-icon" src=")data:image\/webp;base64,[^"]+(")/, `$1${markUri}$2`);
if (!html.includes(markUri)) throw new Error("mark not replaced");

const markVarRe = /(--vfk-mark: )[\d.]+vmax;/;
if (!markVarRe.test(html)) throw new Error("--vfk-mark not found");
html = html.replace(markVarRe, `$1${MARK_VMAX}vmax;`);

// The aperture opens through the mark's OWN bolt, so the mask is this bolt.
const boltVarRe = /(--vfk-bolt: )url\("data:image\/webp;base64,[^"]+"\);/;
if (!boltVarRe.test(html)) throw new Error("--vfk-bolt not found");
html = html.replace(boltVarRe, `$1url("data:image/webp;base64,${boltWebp.toString("base64")}");`);

// the field: the plane (which the bolt hole is punched through) and the HOLD
// frame painted by the root before the native launch image is dropped.
const planeRe = /(\.vfk-plane\{\s*inset:0;\s*background:)[^;]+;/;
if (!planeRe.test(html)) throw new Error("plane background not found");
html = html.replace(planeRe, `$1${cssFieldFull};`);
const holdRe = /(html\.sc-splash-hold #sc-splash-vfork\{ background:)[^;]+;( \})/;
if (!holdRe.test(html)) throw new Error("hold background not found");
html = html.replace(holdRe, `$1${cssFieldFull};$2`);

// keep the prose truthful
html = html.replace(
  /Hands off from the static iOS launch image \([^)]*\)/,
  `Hands off from the static iOS launch image (the owner's field — a ${ANGLE_DEG}deg blue gradient with the sheen across the top — and the mark at ${MARK_VMAX}vmax, centred)`,
);
html = html.replace(
  /<!-- the ground:[^>]*-->/,
  `<!-- the ground: the owner's field, full screen = the launch image (v3, 2026-09-20). Later it gets a bolt-shaped hole punched through it. -->`,
);
writeFileSync(V3, html);

if (process.argv.includes("--preview")) {
  const dir = process.env.PREVIEW_DIR || ".";
  mkdirSync(dir, { recursive: true });
  const [W, H] = [402, 800];
  const scale = Math.max(W, H) / CANVAS;
  const full = await sharp(splash).resize(Math.round(CANVAS * scale)).toBuffer();
  const left = Math.round((CANVAS * scale - W) / 2);
  await sharp(full).extract({ left, top: 0, width: W, height: H }).png().toFile(`${dir}/v3-launch.png`);
  await sharp(markPng).flatten({ background: "#1b2a5e" }).png().toFile(`${dir}/v3-mark.png`);
}
console.log("field:", cssField);
console.log("mark:", MARK_VMAX + "vmax", "=", MARK_PX + "px of", CANVAS, "| card", CARD_VMAX.toFixed(3) + "vmax");
console.log("mark webp bytes:", markWebp.length, "| bolt mask bytes:", boltWebp.length, "| launch png bytes:", splash.length);
