// Rebuild the two images the native splash inlines (src/lib/splash/markup.html).
//
//   node scripts/build-splash-assets.mjs
//
// Both are derived from the SHIPPED app icon so the splash can never drift from
// the real mark:
//   • the icon itself, with its corner padding made transparent. public/icon-512.png
//     is a solid square whose corners are filled with the splash navy; opaque, it
//     showed as a dark box the moment light passed behind it during the strike.
//   • the bolt silhouette, extracted from that same file, used as the mask that
//     opens at the end — so the window really is the logo's own lightning bolt.
//
// Writes WebP data URIs into markup.html in place. Requires `sharp`.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const ICON = "public/icon-512.png";
const MARKUP = "src/lib/splash/markup.html";
const R = 106;              // corner radius measured from the artwork (of 512)
const SIZE = 512;

// Rounded-square alpha, computed per pixel rather than rasterised from SVG:
// sharp's SVG density can yield a bitmap that refuses to composite, and the
// maths here is exact and dependency-free. 4x supersampling antialiases the arc.
function roundedAlpha(size, radius) {
  const a = Buffer.alloc(size * size);
  const S = 4, inv = 1 / (S * S);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const px = x + (sx + 0.5) / S, py = y + (sy + 0.5) / S;
          const cx = Math.min(Math.max(px, radius), size - radius);
          const cy = Math.min(Math.max(py, radius), size - radius);
          const dx = px - cx, dy = py - cy;
          if (dx * dx + dy * dy <= radius * radius) hit++;
        }
      }
      a[y * size + x] = Math.round(255 * hit * inv);
    }
  }
  return a;
}

const iconAlpha = roundedAlpha(SIZE, R);

// Compose RGBA by hand from the source pixels. sharp's joinChannel misaligned
// the buffer here (it shipped a scrambled, opaque image twice), and writing the
// bytes directly is both exact and obvious.
const src = await sharp(ICON).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc(SIZE * SIZE * 4);
for (let i = 0; i < SIZE * SIZE; i++) {
  rgba[i * 4] = src.data[i * src.info.channels];
  rgba[i * 4 + 1] = src.data[i * src.info.channels + 1];
  rgba[i * 4 + 2] = src.data[i * src.info.channels + 2];
  rgba[i * 4 + 3] = iconAlpha[i];
}
const icon = await sharp(rgba, { raw: { width: SIZE, height: SIZE, channels: 4 } })
  .resize(336, 336)
  .webp({ quality: 92, alphaQuality: 100 })
  .toBuffer();

// The bolt: the near-white pixels of the icon. Opaque bolt on a transparent
// field works whether the browser masks by alpha or by luminance.
const { data, info } = await sharp(ICON).raw().toBuffer({ resolveWithObject: true });
const a = Buffer.alloc(info.width * info.height);
for (let i = 0, p = 0; i < data.length; i += info.channels, p++) {
  a[p] = data[i] > 232 && data[i + 1] > 238 && data[i + 2] > 240 ? 255 : 0;
}
const white = Buffer.alloc(info.width * info.height * 3, 255);
const boltRgba = await sharp(white, { raw: { width: info.width, height: info.height, channels: 3 } })
  .joinChannel(a, { raw: { width: info.width, height: info.height, channels: 1 } })
  .webp({ quality: 92 })
  .toBuffer();

let html = readFileSync(MARKUP, "utf8");
html = html.replace(/src="data:image\/webp;base64,[^"]+"/, `src="data:image/webp;base64,${icon.toString("base64")}"`);
html = html.replace(/url\("data:image\/webp;base64,[^"]+"\)/, `url("data:image/webp;base64,${boltRgba.toString("base64")}")`);
writeFileSync(MARKUP, html);
console.log(`icon ${(icon.length / 1024).toFixed(1)}KB · bolt ${(boltRgba.length / 1024).toFixed(1)}KB → ${MARKUP}`);
