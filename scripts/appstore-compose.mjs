// Compose the App Store screenshot set: 1320 x 2868, one identical frame
// system across every shot.
//
// IDENTICAL means identical: same background, same caption block position and
// size, same device geometry, same shadow, on every frame. Only the words and
// the screen behind the glass change. A set where the phone moves or the type
// resizes between frames reads as amateur even when each frame is fine alone.
//
// v3 (2026-09-06) — what changed from the v2 frame and why:
//   - The phone is 1180 wide and runs off the bottom edge. In search results
//     the frame is ~200px tall; the v2 phone (1040 wide, fully inside the
//     frame) put the actual app in a third of the pixels. Bleeding the device
//     off the bottom is how every top-grossing listing buys screen size.
//   - A status bar and Dynamic Island sit inside the glass. The captures are
//     web-page renders with no system chrome, and a bare web page in a phone
//     silhouette reads as a website in a picture frame, not an app.
//   - A kicker pill above the headline names the feature, and one phrase per
//     headline is set in the accent tint — hierarchy the v2 flat white text
//     did not have.
//   - Full-page captures no longer carry the tab bar mid-screen (fixed in
//     appstore-capture.mjs); the v2 dashboard frame had the tab bar floating
//     above the chart.
//
// Every screen is a real capture of the running app (scripts/appstore-capture.mjs),
// which is what Apple 2.3.3 requires — captions and device frames around a real
// screen are allowed and expected.
import { writeFileSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";

const RAW = process.env.RAW || "app-store/screenshots/_raw";
const OUT = process.env.OUT || "app-store/screenshots/6.9-inch-v3";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const W = 1320, H = 2868;

// Device geometry. 1180px across for a 440pt-wide capture → 2.68 px/pt, so
// the iPhone's 55pt screen corner is ~148px and the 54pt status bar ~145px.
const DEV_W = 1180, BEZEL = 14, RADIUS = 140, TOP = 985;
const BAR = 145;                    // status bar height, in device px
const scale = DEV_W / W;            // captures are 1320 wide
const GLASS_VISIBLE = H - TOP - BEZEL;                    // device px on the frame
const SRC_VISIBLE = Math.round((GLASS_VISIBLE - BAR) / scale); // source rows on the glass

// PNG height straight from the IHDR chunk — no image library needed, and it
// means the y offsets are checked against the file on disk, not a number
// someone typed in months ago (the v2 script carried stale heights).
const pngHeight = (p) => readFileSync(p).readUInt32BE(20);

// bar: the status-bar backdrop. Light pages get their own page colour behind
// dark glyphs; a page that opens on a photo (Swift Links) gets the bar laid
// over the image with white glyphs instead.
// y: where the glass starts in the source. y + SRC_VISIBLE must fit the file.
const FRAMES = [
  { n: "01", src: "public-card",   y: 0,    kicker: "Digital business card",
    title: "Your card.\n<em>One link.</em>",
    sub: "Text it, show the QR, or tap an NFC card. It opens anywhere, no app needed.",
    bar: { bg: "#e2e0dd", fg: "#111" } },
  { n: "02", src: "public-card",   y: 865,  kicker: "Save contact",
    title: "They save you\n<em>in one tap</em>",
    sub: "Straight into their phone contacts, and they can send their details back.",
    bar: { bg: "#e2e0dd", fg: "#111" } },
  { n: "03", src: "contacts",      y: 0,    kicker: "Contacts",
    title: "Every lead,\n<em>in your pocket</em>",
    sub: "Who they are, how you met, and what to do next.",
    bar: { bg: "#fbf7f1", fg: "#111" } },
  { n: "04", src: "swift-links",   y: 0,    kicker: "Swift Links",
    title: "All your links,\n<em>one page</em>",
    sub: "Photo, bio, socials, portfolio and booking at your own link.",
    bar: { overlay: true, fg: "#fff" } },
  { n: "05", src: "signature",     y: 200,  kicker: "Swift Signature",
    title: "Your card in\n<em>every email</em>",
    sub: "A live card under every message you send. Paste it once.",
    bar: { bg: "#4b4948", fg: "#fff" } },
  { n: "06", src: "dashboard",     y: 1660, kicker: "Analytics",
    title: "See exactly\n<em>who’s looking</em>",
    sub: "Views by hour, by source and by town, updated as they happen.",
    bar: { bg: "#fbf7f1", fg: "#111" } },
  { n: "07", src: "ways-to-share", y: 610,  kicker: "Share",
    title: "QR, NFC and\n<em>Apple Wallet</em>",
    sub: "However you meet people, your card is one tap away.",
    bar: { bg: "#646360", fg: "#fff" } },
  { n: "08", src: "contact-detail", y: 760, kicker: "Follow-ups",
    title: "It writes the\n<em>follow-up</em> for you",
    sub: "AI drafts each message from where you met and what you noted.",
    bar: { bg: "#faf7f2", fg: "#111" } },
];

const statusBar = (bar) => `
<div class="bar" style="${bar.overlay ? "" : `background:${bar.bg};`}color:${bar.fg}">
  <span class="time">9:41</span>
  <span class="right">
    <svg width="46" height="30" viewBox="0 0 46 30" fill="currentColor"><rect x="0" y="18" width="8" height="12" rx="2"/><rect x="12" y="13" width="8" height="17" rx="2"/><rect x="24" y="7" width="8" height="23" rx="2"/><rect x="36" y="0" width="8" height="30" rx="2"/></svg>
    <svg width="40" height="30" viewBox="0 0 40 30" fill="currentColor"><path d="M20 30 27.5 21a10.5 10.5 0 0 0-15 0zM8.5 15.5 12 19.5a12 12 0 0 1 16 0l3.5-4a17 17 0 0 0-23 0zM0 9.5 3.8 13.5a24 24 0 0 1 32.4 0L40 9.5a30 30 0 0 0-40 0z"/></svg>
    <span class="batt"><i></i></span>
  </span>
</div>
<div class="island"></div>`;

const page = (f, srcH) => `<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&display=swap');
  * { margin: 0; box-sizing: border-box; }
  body {
    width: ${W}px; height: ${H}px; overflow: hidden; position: relative;
    background:
      radial-gradient(70% 34% at 50% 58%, rgba(59,130,246,.62) 0%, rgba(59,130,246,0) 100%),
      radial-gradient(120% 70% at 50% -10%, #1E4FC2 0%, #10286A 45%, #070F2A 100%);
    font-family: Inter, -apple-system, system-ui, sans-serif;
    display: flex; flex-direction: column; align-items: center; padding: 150px 80px 0;
  }
  .kicker {
    color: #fff; font-size: 30px; font-weight: 700; letter-spacing: .14em;
    text-transform: uppercase; padding: 16px 32px; border-radius: 999px;
    background: rgba(255,255,255,.12); border: 2px solid rgba(255,255,255,.22);
    backdrop-filter: blur(6px); margin-bottom: 44px;
  }
  h1 { color: #fff; font-size: 124px; line-height: 1.04; font-weight: 800;
       letter-spacing: -.04em; text-align: center; white-space: pre-line; }
  h1 em { font-style: normal; color: #8DC3FF; }
  p  { color: rgba(255,255,255,.78); font-size: 44px; line-height: 1.32; font-weight: 600;
       text-align: center; margin-top: 30px; max-width: 1040px; letter-spacing: -.012em; }
  .device { position: absolute; top: ${TOP}px; left: ${(W - DEV_W) / 2 - BEZEL}px;
       width: ${DEV_W + BEZEL * 2}px; height: ${H - TOP + 200}px;
       background: #0B0B10; border-radius: ${RADIUS + BEZEL}px; padding: ${BEZEL}px;
       box-shadow: 0 -20px 120px -20px rgba(0,0,0,.75), 0 0 0 2.5px rgba(255,255,255,.16),
                   0 0 0 6px rgba(0,0,0,.35); }
  .screen { width: ${DEV_W}px; height: 100%; border-radius: ${RADIUS}px;
       overflow: hidden; position: relative; background: ${f.bar.bg || "#000"}; }
  .screen img { position: absolute; left: 0; top: ${(f.bar.overlay ? 0 : BAR) - f.y * scale}px;
       width: ${DEV_W}px; height: ${srcH * scale}px; display: block; }
  .bar { position: absolute; top: 0; left: 0; right: 0; height: ${BAR}px; z-index: 2;
       display: flex; align-items: center; justify-content: space-between; padding: 0 74px 0 84px;
       font-size: 46px; font-weight: 700; letter-spacing: -.02em; }
  .bar .right { display: flex; align-items: center; gap: 18px; }
  .batt { display: inline-block; width: 74px; height: 36px; border: 4px solid currentColor;
       border-radius: 11px; padding: 4px; opacity: .95; position: relative; }
  .batt i { display: block; width: 100%; height: 100%; background: currentColor; border-radius: 4px; }
  .batt::after { content: ""; position: absolute; right: -11px; top: 9px; width: 6px; height: 12px;
       background: currentColor; border-radius: 0 4px 4px 0; }
  .island { position: absolute; top: 30px; left: 50%; width: 340px; height: 100px;
       transform: translateX(-50%); background: #000; border-radius: 60px; z-index: 3; }
</style>
<div class="kicker">${f.kicker}</div>
<h1>${f.title}</h1>
<p>${f.sub}</p>
<div class="device"><div class="screen">
  ${statusBar(f.bar)}
  <img src="file://${process.cwd()}/${RAW}/${f.src}.png">
</div></div>`;

let bad = 0;
for (const f of FRAMES) {
  const srcH = pngHeight(`${RAW}/${f.src}.png`);
  if (f.y + SRC_VISIBLE > srcH) {
    console.error(`  ! ${f.n} would run ${f.y + SRC_VISIBLE - srcH}px past the end of ${f.src} (${srcH})`);
    bad++;
  }
  const file = `${f.n}-${f.src}.png`;
  const html = `${OUT}/_${file}.html`;
  writeFileSync(html, page(f, srcH));
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--window-size=${W},${H}`, "--virtual-time-budget=8000",
    `--screenshot=${OUT}/${file}`, `file://${process.cwd()}/${html}`], { stdio: "ignore" });
  unlinkSync(html);
  console.log("rendered", file);
}
console.log(bad ? `${bad} frame(s) overrun — fix the y offsets` : "all frames fit their source");
