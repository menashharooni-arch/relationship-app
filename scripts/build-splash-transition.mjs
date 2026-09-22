// Build the TRANSITION splashes — the v3 launch animation for apps that are
// still carrying an older launch image (owner, 2026-09-22: "I don't want to
// wait for the review").
//
//   node scripts/build-splash-transition.mjs
//
// THE PROBLEM. The launch image is compiled into the app bundle, so a phone
// with build 12 installed shows THAT image at launch, whatever the server
// sends. The animation's first frame has to be identical to it or the mark
// jumps the instant the webview takes over — which is why NativeSplash only
// hands the v3 animation to a build that carries the v3 image.
//
// THE FIX, for the apps already out there: start on the OLD screen, exactly as
// now, and cross-fade to the new one inside the first third of a second —
// under the charge, just before the fork comes down. The handoff stays
// pixel-identical, and by the time the lightning strikes, the screen is the new
// one. From then on it is the v3 sequence, unchanged.
//
// Two outputs, because two old launch images exist:
//   markup-v1to3.html   navy field + the app icon      (builds before v2)
//   markup-v2to3.html   the logo's gradient + its mark (builds carrying v2)
//
// Each is markup-v3.html plus ONE extra layer: a full-screen copy of that
// build's own launch image, painted over the v3 ground and faded out. Nothing
// else about the sequence is touched, so there is one animation to maintain.
import { readFileSync, writeFileSync } from "node:fs";

const V1 = "src/lib/splash/markup.html";
const V2 = "src/lib/splash/markup-v2.html";
const V3 = "src/lib/splash/markup-v3.html";

// The master clock is 1400ms, and it starts the moment the native launch image
// is taken away — so clock 0 is the first frame the person actually sees from
// us. The old screen is therefore given NO time of its own (owner, 2026-09-22:
// remove the navy screen with the app icon, keep the new one): the cross-fade
// begins immediately and is over in 130ms, before the fork starts at 150ms.
//
// It cannot be zero. Frame 0 has to BE the launch image compiled into that
// build, or the mark jumps at the handoff — the one rule none of this may
// break. A 130ms fade is the shortest that still reads as a change of light
// rather than a pop, and it is the closest thing to "gone" that is possible
// without a new App Store build, where the launch image itself is the new one.
const FADE_START_MS = 0;
const FADE_END_MS = 130;
const CLOCK_MS = 1400;
const pct = (ms) => +((ms / CLOCK_MS) * 100).toFixed(4);

/** Everything needed to repaint one old launch image as a single layer. */
function frameZeroOf(file) {
  const html = readFileSync(file, "utf8");
  const hold = html.match(/html\.sc-splash-hold #sc-splash-vfork\{ background:([^;]+); \}/);
  if (!hold) throw new Error(`${file}: no hold background`);
  const mark = html.match(/<img class="vfk-icon" src="(data:image\/webp;base64,[^"]+)"/);
  if (!mark) throw new Error(`${file}: no mark`);
  const size = html.match(/--vfk-mark: ([\d.]+)vmax;/);
  if (!size) throw new Error(`${file}: no --vfk-mark`);
  return { ground: hold[1].trim(), mark: mark[1], markVmax: size[1] };
}

const v3 = readFileSync(V3, "utf8");

for (const [name, file] of [["v1to3", V1], ["v2to3", V2]]) {
  const old = frameZeroOf(file);
  let html = v3;

  // 1. The root paints the OLD ground while held — it is what shows before any
  //    image decodes, and it has to match the image the phone is already
  //    showing, not the new one.
  html = html.replace(
    /(html\.sc-splash-hold #sc-splash-vfork\{ background:)[^;]+;( \})/,
    `$1${old.ground};$2`,
  );

  // 2. The old screen itself, as one layer: its mark centred at its own size,
  //    over its own ground. Inserted after the v3 mark so it covers the new
  //    artwork, and before the fork so the lightning still draws on top.
  const layer =
    `\n  <!-- THE OLD LAUNCH IMAGE (${name}): what this build has compiled in. Frame 0 is\n` +
    `       this, pixel for pixel; it cross-fades to the new screen at ${FADE_START_MS}-${FADE_END_MS}ms,\n` +
    `       under the charge and before the fork lands. scripts/build-splash-transition.mjs -->\n` +
    `  <div class="vfk-legacy"></div>\n`;
  // \r?\n: the generated markup carries CRLF on Windows.
  const anchor = /(<img class="vfk-icon"[^>]*>\r?\n)/;
  if (!anchor.test(html)) throw new Error("mark element not found");
  html = html.replace(anchor, `$1${layer}`);

  // 3. Its CSS, next to the mark's own rule so the two are read together.
  const css =
    `\n.vfk-legacy{\n` +
    `  inset:0;\n` +
    `  background:url("${old.mark}") 50% 50% / ${old.markVmax}vmax ${old.markVmax}vmax no-repeat,${old.ground};\n` +
    `  animation:vfk-legacy-out ${CLOCK_MS}ms linear both;\n` +
    `}\n` +
    `@keyframes vfk-legacy-out{\n` +
    `  0%{ opacity:1 }   /* the launch image this build carries */\n` +
    // Only when the fade is held off for a while; at 0 it would repeat the stop above.
    (FADE_START_MS > 0 ? `  ${pct(FADE_START_MS)}%{ opacity:1 }   /* ${FADE_START_MS}ms */\n` : "") +
    `  ${pct(FADE_END_MS)}%{ opacity:0 }   /* ${FADE_END_MS}ms  now it is the new screen */\n` +
    `  100%{ opacity:0 }\n` +
    `}\n`;
  const cssAnchor = "/* ── layer 2: ignition bloom, behind the logo ───────────────────────────── */";
  if (!html.includes(cssAnchor)) throw new Error("css anchor not found");
  html = html.replace(cssAnchor, `${css}${cssAnchor}`);

  // 4. Say what this file is, at the top of its own comment block.
  html = html.replace(
    /(Hands off from the static iOS launch image )\([^)]*\)/,
    `$1(${name === "v1to3" ? "the navy field with the square icon" : "the logo's gradient with its mark"}, which is what THIS build has compiled in), then cross-fades to the new screen at ${FADE_START_MS}-${FADE_END_MS}ms`,
  );

  writeFileSync(`src/lib/splash/markup-${name}.html`, html);
  console.log(`markup-${name}.html — frame 0: ${old.markVmax}vmax mark over ${old.ground.slice(0, 48)}…`);
}
