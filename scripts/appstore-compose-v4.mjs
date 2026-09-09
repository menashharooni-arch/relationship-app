// Compose the App Store screenshot set, v4: 1320 x 2868, one frame system.
//
// v4 (2026-09-09) — what changed from v3 and why:
//   - Pop-outs. Every top-grossing listing lifts one or two real UI elements
//     off the glass and floats them over the device edge with a deep shadow:
//     it gives the frame depth, fills the dead band v3 had between the caption
//     and the phone, and shows the one thing the frame is about at a size a
//     search-result thumbnail can read. Each pop-out is a replica of a real
//     app component carrying the real value from the seeded account (the
//     4,354 views, Jordan's share-back, Portland's 3,250) — nothing on a
//     pop-out is invented, it is the same row the screen behind it shows.
//   - Headlines are shorter and larger, one accent phrase each, set in
//     Geist (the app's own typeface) instead of Inter.
//   - The background has depth: a brand-blue gradient with a glow behind the
//     device, a diagonal light sheen and film grain, instead of two flat radial
//     gradients.
//   - The device has side buttons, a specular edge and a layered shadow.
//   - The phone starts higher (900 vs 985) so more app is visible.
//
// Every screen is still a real capture of the running app
// (scripts/appstore-capture.mjs) — Apple 2.3.3. Captions, device frames and
// callouts around a real screen are allowed and expected.
import { writeFileSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";

const RAW = process.env.RAW || "app-store/screenshots/_raw";
const OUT = process.env.OUT || "app-store/screenshots/6.9-inch-v4";
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const W = 1320, H = 2868;
const DEV_W = 1180, BEZEL = 14, RADIUS = 140, TOP = 900;
const BAR = 145;
const scale = DEV_W / W;
const GLASS_VISIBLE = H - TOP - BEZEL;
const SRC_VISIBLE = Math.round((GLASS_VISIBLE - BAR) / scale);
const pngHeight = (p) => readFileSync(p).readUInt32BE(20);

// ── Pop-out components. Styled to the app: cream/white surfaces, 1px hairline,
//    Geist, blue #2563EB, ink #111. Sized for the 2.68 px/pt device scale.
const dot = `<i class="dot"></i>`;
const readBtn = `<span class="read">Read</span>`;
const notif = (title, sub, ago) => `
<div class="pop card notif">
  ${dot}<div class="body"><b>${title}</b><span>${sub}</span><small>${ago}</small></div>${readBtn}
</div>`;
const stat = (label, value, hint) => `
<div class="pop card stat"><span class="lbl">${label}</span><b>${value}</b>${hint ? `<small>${hint}</small>` : ""}</div>`;
const chip = (html) => `<div class="pop chip">${html}</div>`;
const badge = (t, cls = "") => `<span class="badge ${cls}">${t}</span>`;
const loc = (town, total, card, links) => `
<div class="pop card loc"><div class="row"><b>${town}</b><span><b>${total}</b> views</span></div>
<div class="split">SwiftCard <b>${card}</b> &nbsp;&nbsp; Swift Links <b>${links}</b></div></div>`;
const check = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const pin = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/></svg>`;
const person = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`;
const apple = `<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8zM14.1 5.8c.6-.8 1.1-1.9.9-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z"/></svg>`;
const arrow = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;

// Each frame: the screen crop (src, y), the caption, the status bar, and the
// pop-outs with their position (top/left/right in frame px) and tilt.
const FRAMES = [
  { n: "01", src: "public-card", y: 0, kicker: "Digital business card",
    title: "Your card.\n<em>One link.</em>",
    sub: "Text it, show the QR, or tap an NFC card. Opens anywhere, no app needed.",
    bar: { bg: "#e2e0dd", fg: "#111" },
    pops: [
      { html: notif("Marcus Webb saved your contact", "Webb &amp; Co. · via your link", "1d ago"), at: "top:790px; left:46px", rot: -3 },
    ] },
  { n: "02", src: "public-card-shared", y: 850, kicker: "Share back",
    title: "Tap to save.\n<em>They share back.</em>",
    sub: "One tap adds you to their phone. Their details come straight to you.",
    bar: { bg: "#e2e0dd", fg: "#111" },
    pops: [
      { html: notif("Jordan Rivera shared their info", "Rivera Design Co. · via QR code", "3h ago"), at: "top:790px; right:40px", rot: 3 },
    ] },
  { n: "03", src: "contacts", y: 0, kicker: "Contacts",
    title: "Every lead,\n<em>in your pocket</em>",
    sub: "Who they are, how they found you, and what to do next.",
    bar: { bg: "#fbf7f1", fg: "#111" },
    pops: [
      { html: chip(`${badge("QR code scan")}${badge("NFC tap")}${badge("Swift Links")}${badge("Swift Signature")}`), at: "top:800px; left:50%; transform:translateX(-50%) rotate(-2deg)", rot: null },
    ] },
  { n: "04", src: "contact-detail", y: 90, kicker: "Contact",
    title: "Who they are,\n<em>where you met</em>",
    sub: "Notes, context and the next step, all in one place.",
    bar: { bg: "#faf7f2", fg: "#111" },
    pops: [
      { html: `<div class="pop card note"><span class="lbl">${pin} Where did you meet?</span><b>Rivera Design Co. studio opening, Pearl District</b></div>`, at: "top:790px; right:46px", rot: 2.5 },
    ] },
  { n: "05", src: "contact-detail-automations", y: 0, kicker: "Follow-ups",
    title: "Follow-ups\n<em>write themselves</em>",
    sub: "An email and text sequence written from your notes, sent on schedule.",
    bar: { bg: "#faf7f2", fg: "#111" },
    pops: [
      { html: `<div class="pop card mail"><div class="row"><span>Sent Sep 8, 9:12 AM</span>${check}</div><b>Subject: Great meeting you</b><span class="txt">Hi Jordan, lovely to meet you today. Here’s my portfolio and the 2026 packages we talked about…</span></div>`, at: "top:770px; left:46px", rot: -2.5 },
      { html: chip(`<i class="on"></i><span>On · Medium · 3 emails</span>`), at: "top:2180px; right:30px", rot: 3, blue: true },
    ] },
  { n: "06", src: "dashboard", y: 2150, kicker: "Analytics",
    title: "Know who’s\n<em>looking</em>",
    sub: "Views by day, by source, by town. Who came back, and when.",
    bar: { bg: "#fbf7f1", fg: "#111" },
    pops: [
      { html: stat("SwiftCard views · Month", "4,354", "Best day <b>Sep 2</b> · 700"), at: "top:760px; left:44px", rot: -3 },
      { html: chip(`${pin}<span>Portland, OR · <b>3,250</b> views</span>`), at: "top:2100px; right:34px", rot: 2.5 },
    ] },
  { n: "07", src: "dashboard-locations", y: 2270, kicker: "Locations",
    title: "Which towns\n<em>find you</em>",
    sub: "Every view placed on the map, split between your card and Swift Links.",
    bar: { bg: "#fbf7f1", fg: "#111" },
    pops: [
      { html: loc("Portland, OR", "3,250", "2,642", "608"), at: "top:780px; right:40px", rot: 2.5 },
    ] },
  { n: "08", src: "swift-links", y: 0, kicker: "Swift Links",
    title: "All your links,\n<em>one page</em>",
    sub: "Photo, bio, socials, portfolio and booking at your own link.",
    bar: { overlay: true, fg: "#fff" },
    pops: [
      { html: `<div class="pop card link"><span class="emoji">🎬</span><b>Watch the 2026 wedding reel</b>${arrow}</div>`, at: "top:2630px; left:40px", rot: -2.5 },
    ] },
  { n: "09", src: "signature", y: 200, kicker: "Swift Signature",
    title: "Your card in\n<em>every email</em>",
    sub: "A live card under every message you send. Paste it once.",
    bar: { bg: "#4b4948", fg: "#fff" },
    pops: [
      { html: chip(`${check}<span>Signature copied</span>`), at: "top:800px; right:60px", rot: 3, big: true },
    ] },
  { n: "10", src: "ways-to-share", y: 610, kicker: "Share",
    title: "QR, NFC and\n<em>Apple Wallet</em>",
    sub: "However you meet people, your card is one tap away.",
    bar: { bg: "#646360", fg: "#fff" },
    pops: [
      { html: chip(`${apple}<span>Add to Apple Wallet</span>`), at: "top:790px; left:50%; transform:translateX(-50%) rotate(-2deg)", rot: null, wallet: true },
    ] },
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

const NOISE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

const popStyle = (p) => {
  const rot = p.rot == null ? "" : `transform: rotate(${p.rot}deg);`;
  return `${p.at}; ${rot}`;
};

const page = (f, srcH) => `<style>
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&display=swap');
  * { margin: 0; box-sizing: border-box; }
  body {
    width: ${W}px; height: ${H}px; overflow: hidden; position: relative;
    background:
      linear-gradient(118deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 38%),
      radial-gradient(62% 30% at 50% 44%, rgba(77,168,245,.55) 0%, rgba(77,168,245,0) 100%),
      radial-gradient(140% 80% at 50% -20%, #2563EB 0%, #1740B5 34%, #0E2470 62%, #050B24 100%);
    font-family: Geist, -apple-system, system-ui, sans-serif;
    display: flex; flex-direction: column; align-items: center; padding: 140px 70px 0;
  }
  body::before { content: ""; position: absolute; inset: 0; background: ${NOISE};
    opacity: .085; mix-blend-mode: overlay; pointer-events: none; z-index: 1; }
  .kicker {
    color: #fff; font-size: 28px; font-weight: 700; letter-spacing: .16em;
    text-transform: uppercase; padding: 15px 30px; border-radius: 999px;
    background: rgba(255,255,255,.12); border: 2px solid rgba(255,255,255,.26);
    margin-bottom: 40px; position: relative; z-index: 2;
  }
  h1 { color: #fff; font-size: 138px; line-height: .98; font-weight: 800;
       letter-spacing: -.045em; text-align: center; white-space: pre-line; position: relative; z-index: 2;
       text-shadow: 0 6px 40px rgba(0,0,0,.25); }
  h1 em { font-style: normal; color: #9DD0FF; }
  p  { color: rgba(255,255,255,.80); font-size: 42px; line-height: 1.3; font-weight: 500;
       text-align: center; margin-top: 30px; max-width: 980px; letter-spacing: -.012em; position: relative; z-index: 2; }

  /* device */
  .device { position: absolute; top: ${TOP}px; left: ${(W - DEV_W) / 2 - BEZEL}px;
       width: ${DEV_W + BEZEL * 2}px; height: ${H - TOP + 200}px;
       background: linear-gradient(180deg, #2a2a30, #0B0B10 40%); border-radius: ${RADIUS + BEZEL}px; padding: ${BEZEL}px;
       box-shadow: 0 -30px 140px -10px rgba(0,0,0,.7), 0 60px 120px -30px rgba(0,0,0,.8),
                   0 0 0 2.5px rgba(255,255,255,.22), 0 0 0 7px rgba(0,0,0,.45),
                   inset 0 2px 0 rgba(255,255,255,.35); z-index: 3; }
  .btn { position: absolute; background: #1c1c22; width: 9px; border-radius: 4px;
       box-shadow: 0 0 0 1.5px rgba(255,255,255,.14); }
  .btn.mute { left: -14px; top: 300px; height: 70px; }
  .btn.vup  { left: -14px; top: 430px; height: 150px; }
  .btn.vdn  { left: -14px; top: 610px; height: 150px; }
  .btn.pwr  { right: -14px; top: 480px; height: 230px; }
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

  /* pop-outs */
  .pop { position: absolute; z-index: 5; font-family: Geist, -apple-system, system-ui, sans-serif;
       color: #111; letter-spacing: -.01em; }
  .card { background: #fff; border: 2px solid rgba(17,24,39,.08); border-radius: 34px;
       box-shadow: 0 50px 90px -20px rgba(0,0,0,.65), 0 20px 40px -20px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.35); }
  .notif { display: flex; align-items: flex-start; gap: 22px; padding: 34px 36px 34px 40px; width: 1000px; }
  .notif .dot { width: 20px; height: 20px; border-radius: 50%; background: #2563EB; margin-top: 16px; flex: none; }
  .notif .body { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .notif b { font-size: 42px; font-weight: 700; letter-spacing: -.02em; }
  .notif span { font-size: 34px; color: #4b5563; font-weight: 500; }
  .notif small { font-size: 30px; color: #9ca3af; font-weight: 500; margin-top: 4px; }
  .read { flex: none; margin-top: 6px; padding: 16px 30px; border-radius: 22px; font-size: 32px; font-weight: 600;
       color: #2563EB; background: #DBEAFE; border: 2px solid #BFDBFE; }
  .stat { padding: 40px 56px 40px; width: 720px; display: flex; flex-direction: column; gap: 4px;
       background: linear-gradient(180deg, #fff, #f3ece2); }
  .stat .lbl { font-size: 32px; color: #4b5563; font-weight: 600; letter-spacing: .01em; }
  .stat > b { font-size: 132px; font-weight: 800; letter-spacing: -.05em; line-height: 1.05; }
  .stat small { font-size: 32px; color: #4b5563; font-weight: 500; margin-top: 6px; }
  .stat small b { color: #111; font-weight: 700; }
  .chip { display: flex; align-items: center; gap: 18px; padding: 26px 44px; border-radius: 999px;
       background: #fff; font-size: 38px; font-weight: 700; letter-spacing: -.02em; white-space: nowrap;
       box-shadow: 0 40px 80px -16px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.35); }
  .chip.dark { background: #0f172a; color: #fff; }
  .chip.blue { background: #DBEAFE; color: #1d4ed8; border: 2px solid #BFDBFE; }
  .chip.wallet { background: #5B5BF6; color: #fff; padding: 30px 60px; font-size: 44px; }
  .chip b { font-weight: 800; }
  .chip svg { color: #2563EB; }
  .chip.wallet svg, .chip.dark svg { color: inherit; }
  .chip.big { padding: 32px 56px; font-size: 44px; }
  .chip .on { width: 20px; height: 20px; border-radius: 50%; background: #2563EB; }
  .badge { padding: 14px 24px; border-radius: 999px; background: #EFF6FF; color: #2563EB; font-size: 30px; font-weight: 600;
       border: 2px solid #DBEAFE; }
  .chip:has(.badge) { padding: 24px 28px; gap: 14px; }
  .loc { width: 900px; padding: 36px 44px; background: #F5EFE6; border-color: rgba(17,24,39,.1); }
  .loc .row { display: flex; justify-content: space-between; align-items: baseline; }
  .loc .row > b { font-size: 44px; font-weight: 700; letter-spacing: -.02em; }
  .loc .row span { font-size: 32px; color: #4b5563; font-weight: 500; }
  .loc .row span b { font-size: 46px; color: #111; font-weight: 700; letter-spacing: -.02em; }
  .loc .split { margin-top: 18px; font-size: 32px; color: #4b5563; font-weight: 500; }
  .loc .split b { color: #111; font-weight: 700; }
  .note { width: 980px; padding: 36px 44px; display: flex; flex-direction: column; gap: 14px; }
  .note .lbl { display: flex; align-items: center; gap: 12px; font-size: 32px; color: #4b5563; font-weight: 600; }
  .note > b { font-size: 40px; font-weight: 600; line-height: 1.25; letter-spacing: -.02em; }
  .mail { width: 940px; padding: 36px 44px; background: #F5EFE6; display: flex; flex-direction: column; gap: 10px; }
  .mail .row { display: flex; justify-content: space-between; align-items: center; font-size: 30px; color: #4b5563; font-weight: 600; }
  .mail > b { font-size: 38px; font-weight: 700; letter-spacing: -.02em; }
  .mail .txt { font-size: 32px; color: #374151; font-weight: 500; line-height: 1.35; }
  .link { width: 900px; padding: 30px 40px; display: flex; align-items: center; gap: 24px; color: #6b7280; }
  .link .emoji { width: 88px; height: 88px; border-radius: 24px; background: #F3F4F6; display: flex; align-items: center;
       justify-content: center; font-size: 46px; flex: none; }
  .link b { flex: 1; font-size: 40px; font-weight: 700; color: #111; letter-spacing: -.02em; }
</style>
<div class="kicker">${f.kicker}</div>
<h1>${f.title}</h1>
<p>${f.sub}</p>
<div class="device">
  <span class="btn mute"></span><span class="btn vup"></span><span class="btn vdn"></span><span class="btn pwr"></span>
  <div class="screen">
  ${statusBar(f.bar)}
  <img src="file://${process.cwd()}/${RAW}/${f.src}.png">
</div></div>
${f.pops.map((p) => p.html
  .replace('class="pop chip"', `class="pop chip${p.dark ? " dark" : ""}${p.blue ? " blue" : ""}${p.wallet ? " wallet" : ""}${p.big ? " big" : ""}"`)
  .replace(/class="pop ([^"]*)"/, (_m, c) => `class="pop ${c}" style="${popStyle(p)}"`)).join("\n")}`;

let bad = 0;
for (const f of FRAMES) {
  if (ONLY && !ONLY.includes(f.n)) continue;
  const srcH = pngHeight(`${RAW}/${f.src}.png`);
  if (f.y + SRC_VISIBLE > srcH) {
    console.error(`  ! ${f.n} would run ${f.y + SRC_VISIBLE - srcH}px past the end of ${f.src} (${srcH})`);
    bad++;
  }
  const file = `${f.n}-${f.src}.png`;
  const html = `${OUT}/_${file}.html`;
  writeFileSync(html, page(f, srcH));
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--window-size=${W},${H}`, "--virtual-time-budget=10000",
    `--screenshot=${OUT}/${file}`, `file://${process.cwd()}/${html}`], { stdio: "ignore" });
  unlinkSync(html);
  console.log("rendered", file);
}
console.log(bad ? `${bad} frame(s) overrun — fix the y offsets` : "all frames fit their source");
