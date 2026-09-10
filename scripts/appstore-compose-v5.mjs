// Compose the App Store screenshot set, v5: 1320 x 2868.
//
// v5 (2026-09-10) — WHY: "make sure our newest pictures show an actual iPhone
// and not just a random screen." v4's device was a rounded rectangle with a
// 14px edge that ran off the bottom of the canvas. Nothing about it said
// "phone": no bottom, no home indicator, a hairline where the titanium should
// be, and a Dynamic Island usually hidden behind a pop-out. It read as a
// floating UI panel.
//
// What v5 changes, and why each one matters:
//
//   1. THE WHOLE DEVICE IS IN FRAME. A phone with no bottom edge can only ever
//      read as a panel — the eye needs the closed silhouette. This is the one
//      change that does most of the work, and it costs screen size: the glass
//      is 960px wide instead of 1180.
//
//   2. REAL PROPORTIONS, from the actual hardware. iPhone 16 Pro Max is
//      163.0 x 77.6 mm with a 73.3 x 159.2 mm display, so the body is 2.1005:1
//      and the black border around the glass is ~2.1mm — about 3% of the body
//      width. v4 drew it at 1.2%, which is why it looked like a screen with a
//      keyline rather than a phone.
//
//   3. THE GLASS SHOWS EXACTLY ONE VIEWPORT. The captures are 1320 x 2868, the
//      6.9" screen is 1320 x 2868, and the glass here keeps that aspect ratio
//      exactly — so a frame shows precisely what someone holding the phone
//      would see. Nothing is cropped to fit a made-up window. `y` stops being
//      a crop and becomes what it should always have been: how far the page is
//      scrolled.
//
//   4. TITANIUM, NOT A KEYLINE. The rail is a multi-stop gradient with
//      specular bands near both edges, because that bright vertical catch is
//      the thing that reads as metal at thumbnail size.
//
//   5. THE PARTS THAT SAY "iPHONE": a correctly-sized Dynamic Island (125 x
//      36.7pt) with its camera lens, which the pop-outs are now routed AROUND
//      (see UPPER/LOWER below) rather than sitting on top of; a home indicator;
//      the Action button / volume pair / power / Camera Control in their real
//      positions; a diagonal glass sheen; and a contact shadow so the device
//      sits on the art instead of floating in front of it.
//
//   6. THE STATUS BAR COLOUR IS MEASURED, not typed per frame. See topColour().
//
// Everything else is v4's and deliberately unchanged: the same real captures,
// the same pop-out components carrying the seeded account's own numbers, the
// same headlines. Only the device and the layout that follows from it moved.
//
// Every screen is still a real capture of the running app
// (scripts/appstore-capture.mjs) — Apple 2.3.3. Captions, device frames and
// callouts around a real screen are allowed and expected.
import { writeFileSync, mkdirSync, readFileSync, unlinkSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { inflateSync } from "node:zlib";

const RAW = process.env.RAW || "app-store/screenshots/_raw";
const OUT = process.env.OUT || "app-store/screenshots/6.9-inch-v5";
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const W = 1320, H = 2868;

// ── The device, derived from the real hardware ───────────────────────────────
// iPhone 16 Pro Max: body 163.0 x 77.6 mm, display 6.9" (73.3 x 159.2 mm),
// 1320 x 2868 px at 3x. Every ratio below is measured off those numbers rather
// than eyeballed, which is what stops the frame reading as "a phone-ish shape".
const SRC_W = 1320, SRC_H = 2868;            // the capture, and the real screen
const GLASS_W = 960;                          // the one number that sets the scale
const scale = GLASS_W / SRC_W;                // 0.727 — source px → frame px
const GLASS_H = Math.round(GLASS_W * (SRC_H / SRC_W));   // keeps the true 2.1727:1
const RAIL = Math.round(GLASS_W * 0.0115);    // titanium visible from the front
const BEZEL = Math.round(GLASS_W * 0.0175);   // black border, ~2.1mm total with the rail
const INSET = RAIL + BEZEL;
const BODY_W = GLASS_W + INSET * 2;
const BODY_H = GLASS_H + INSET * 2;
// Screen corner radius is 55pt on this device; the body's is that plus the inset.
const R_GLASS = Math.round(165 * scale);
const R_BODY = R_GLASS + INSET;

// Vertical placement: caption above, whole phone below, a little air under it.
const TOP = 670;
const BOTTOM_GAP = H - TOP - BODY_H;

// iOS metrics, in capture px, scaled — so they stay right if GLASS_W changes.
const BAR = Math.round(162 * scale);          // 54pt status bar
const ISLAND_W = Math.round(375 * scale);     // 125pt
const ISLAND_H = Math.round(110 * scale);     // 36.7pt
const ISLAND_TOP = Math.round(33 * scale);    // 11pt below the glass edge
const HOME_W = Math.round(420 * scale);       // 140pt
const HOME_H = Math.round(15 * scale);        // 5pt
const HOME_BOTTOM = Math.round(24 * scale);   // 8pt above the glass edge
// How much of the capture the glass can show, under the status bar.
const SRC_VISIBLE = Math.round((GLASS_H - BAR) / scale);
const pngHeight = (p) => readFileSync(p).readUInt32BE(20);

// ── The status bar's colour, read from the capture itself ────────────────────
//
// The captures have no status bar (they are page screenshots), so one is drawn
// over the top of the glass. Its background has to be the colour the page
// actually is at that scroll position or there is a visible seam across the
// top of the phone — and in v4 that colour was typed in by hand per frame, so
// the moment a `y` offset changed the bar stopped matching. Four of the ten had
// already drifted by the time v5 re-scrolled them.
//
// So it is measured instead: decode the capture up to the first row under the
// status bar and sample it. Re-tuning a scroll offset can no longer leave a
// mismatched bar behind, and there is one less number in this file that has to
// be kept true by remembering to.
function topColour(path, y) {
  const buf = readFileSync(path);
  let w = 0, h = 0, depth = 0, type = 0, idat = [];
  for (let i = 8; i < buf.length; ) {
    const len = buf.readUInt32BE(i), tag = buf.toString("ascii", i + 4, i + 8);
    if (tag === "IHDR") {
      w = buf.readUInt32BE(i + 8); h = buf.readUInt32BE(i + 12);
      depth = buf[i + 16]; type = buf[i + 17];
    } else if (tag === "IDAT") idat.push(buf.subarray(i + 8, i + 8 + len));
    else if (tag === "IEND") break;
    i += 12 + len;
  }
  // Only the shape Chrome writes. Anything else falls back to the caller's colour.
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
  if (depth !== 8 || !channels) return null;
  const row = Math.min(Math.max(0, y), h - 1);
  const stride = w * channels;
  const raw = zlibSync(Buffer.concat(idat), (row + 1) * (stride + 1));
  // PNG rows are filtered against the row above, so every row up to `row` has
  // to be reconstructed — there is no shortcut to a single line.
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let r = 0; r <= row; r++) {
    const f = raw[r * (stride + 1)];
    const src = raw.subarray(r * (stride + 1) + 1, (r + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0, b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
    [prev, cur] = [cur, prev];
  }
  const x = Math.floor(w / 2) * channels;   // mid-width: never a rounded corner
  const hex = (n) => n.toString(16).padStart(2, "0");
  return channels >= 3 ? `#${hex(prev[x])}${hex(prev[x + 1])}${hex(prev[x + 2])}`
                       : `#${hex(prev[x]).repeat(3)}`;
}
function zlibSync(buf, atLeast) {
  const out = inflateSync(buf);
  return out.length >= atLeast ? out : Buffer.concat([out, Buffer.alloc(atLeast - out.length)]);
}

// ── Pop-out components. Styled to the app: cream/white surfaces, 1px hairline,
//    Geist, blue #2563EB, ink #111. Sized for the device scale.
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
const apple = `<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8zM14.1 5.8c.6-.8 1.1-1.9.9-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z"/></svg>`;
const arrow = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;

// The seed's day-0 email is sent at 9:12 on capture day; the raw's mtime is
// that day, so the pop-out date matches the screen on every re-run.
const SENT = statSync(`${RAW}/dashboard.png`).mtime.toLocaleDateString("en-US", { month: "short", day: "numeric" });

// ── Where the pop-outs sit ───────────────────────────────────────────────────
// v4 hung them off the TOP edge of the device. That worked when the device was
// a bottomless panel starting at y=900; against a whole phone it does not,
// twice over: the caption now ends only ~120px above the body, so a top pop-out
// covers the sub-heading, and the Dynamic Island is right underneath it.
//
// So they hang off a SIDE edge instead, at shoulder height. Same depth cue —
// the card still breaks the silhouette and casts onto the glass — with the
// caption and the island both left alone. UPPER is the natural resting place
// (just below the island); LOWER is measured from the bottom of the body so
// both track the device if GLASS_W ever changes.
const UPPER = TOP + Math.round(BODY_H * 0.135);
const LOWER = TOP + BODY_H - Math.round(BODY_H * 0.30);

// Each frame: the screen crop (src, y), the caption, the status bar, and the
// pop-outs with their position (top/left/right in frame px) and tilt.
const FRAMES = [
  { n: "01", src: "public-card", y: 0, kicker: "Digital business card",
    title: "Your card.\n<em>One link.</em>",
    sub: "Text it, show the QR, or tap an NFC card. Opens anywhere, no app needed.",
    bar: { bg: "#e2e0dd", fg: "#111" },
    pops: [
      { html: notif("Marcus Webb saved your contact", "Webb &amp; Co. · via your link", "1d ago"), at: `top:${LOWER}px; left:-40px`, rot: -3 },
    ] },
  { n: "02", src: "public-card-shared", y: 850, kicker: "Share back",
    title: "Tap to save.\n<em>They share back.</em>",
    sub: "One tap adds you to their phone. Their details come straight to you.",
    bar: { bg: "#e2e0dd", fg: "#111" },
    pops: [
      { html: notif("Jordan Rivera shared their info", "Rivera Design Co. · via QR code", "3h ago"), at: `top:${UPPER}px; right:-40px`, rot: 3 },
    ] },
  { n: "03", src: "contacts", y: 0, kicker: "Contacts",
    title: "Every lead,\n<em>in your pocket</em>",
    sub: "Who they are, how they found you, and what to do next.",
    bar: { bg: "#fbf7f1", fg: "#111" },
    pops: [
      { html: chip(`${badge("QR code scan")}${badge("NFC tap")}${badge("Swift Links")}${badge("Swift Signature")}`), at: `top:${UPPER}px; left:50%; transform:translateX(-50%) rotate(-2deg)`, rot: null },
    ] },
  { n: "04", src: "contact-detail", y: 90, kicker: "Contact",
    title: "Who they are,\n<em>where you met</em>",
    sub: "Notes, context and the next step, all in one place.",
    bar: { bg: "#faf7f2", fg: "#111" },
    pops: [
      { html: `<div class="pop card note"><span class="lbl">${pin} Where did you meet?</span><b>Rivera Design Co. studio opening, Pearl District</b></div>`, at: `top:${UPPER}px; right:-30px`, rot: 2.5 },
    ] },
  { n: "05", src: "contact-detail-automations", y: 0, kicker: "Follow-ups",
    title: "Follow-ups\n<em>write themselves</em>",
    sub: "An email and text sequence written from your notes, sent on schedule.",
    bar: { bg: "#faf7f2", fg: "#111" },
    pops: [
      { html: `<div class="pop card mail"><div class="row"><span>Sent ${SENT}, 9:12 AM</span>${check}</div><b>Subject: Great meeting you</b><span class="txt">Hi Jordan, lovely to meet you today. Here’s my portfolio and the 2026 packages we talked about…</span></div>`, at: `top:${UPPER}px; left:-30px`, rot: -2.5 },
      { html: chip(`<i class="on"></i><span>On · Medium · 3 emails</span>`), at: `top:${LOWER}px; right:30px`, rot: 3, blue: true },
    ] },
  { n: "06", src: "dashboard", y: 2150, kicker: "Analytics",
    title: "Know who’s\n<em>looking</em>",
    sub: "Views by day, by source, by town. Who came back, and when.",
    bar: { bg: "#fbf7f1", fg: "#111" },
    pops: [
      { html: stat("SwiftCard views · Month", "4,345", "Best day <b>Sep 3</b> · 700"), at: `top:${UPPER}px; left:-30px`, rot: -3 },
      { html: chip(`${pin}<span>Portland, OR · <b>3,193</b> views</span>`), at: `top:${LOWER}px; right:34px`, rot: 2.5 },
    ] },
  { n: "07", src: "dashboard-locations", y: 2270, kicker: "Locations",
    title: "Which towns\n<em>find you</em>",
    sub: "Every view placed on the map, split between your card and Swift Links.",
    bar: { bg: "#fbf7f1", fg: "#111" },
    pops: [
      { html: loc("Portland, OR", "3,193", "2,574", "619"), at: `top:${UPPER}px; right:-30px`, rot: 2.5 },
    ] },
  { n: "08", src: "swift-links", y: 0, kicker: "Swift Links",
    title: "All your links,\n<em>one page</em>",
    sub: "Photo, bio, socials, portfolio and booking at your own link.",
    bar: { overlay: true, fg: "#fff" },
    pops: [
      { html: `<div class="pop card link"><span class="emoji">🎬</span><b>Watch the 2026 wedding reel</b>${arrow}</div>`, at: `top:${LOWER}px; left:0px`, rot: -2.5 },
    ] },
  // y=0 on both of these: the captures are exactly one viewport tall (2868), so
  // now that the glass shows a whole viewport there is nothing to scroll past.
  // v4 offset them by 200 / 610 to fill a shorter window.
  { n: "09", src: "signature", y: 0, kicker: "Swift Signature",
    title: "Your card in\n<em>every email</em>",
    sub: "A live card under every message you send. Paste it once.",
    bar: { bg: "#4b4948", fg: "#fff" },
    pops: [
      { html: chip(`${check}<span>Signature copied</span>`), at: `top:${UPPER}px; right:-10px`, rot: 3, big: true },
    ] },
  { n: "10", src: "ways-to-share", y: 0, kicker: "Share",
    title: "QR, NFC and\n<em>Apple Wallet</em>",
    sub: "However you meet people, your card is one tap away.",
    bar: { bg: "#646360", fg: "#fff" },
    pops: [
      { html: chip(`${apple}<span>Add to Apple Wallet</span>`), at: `top:${UPPER}px; left:50%; transform:translateX(-50%) rotate(-2deg)`, rot: null, wallet: true },
    ] },
];

const statusBar = (bar, bg) => `
<div class="bar" style="color:${bar.fg}; ${bar.overlay ? "" : `background:${bg};`}">
  <span>9:41</span>
  <span class="right">
    <svg width="46" height="30" viewBox="0 0 46 30" fill="currentColor"><rect x="0" y="18" width="8" height="12" rx="2"/><rect x="12" y="13" width="8" height="17" rx="2"/><rect x="24" y="7" width="8" height="23" rx="2"/><rect x="36" y="0" width="8" height="30" rx="2"/></svg>
    <svg width="40" height="30" viewBox="0 0 40 30" fill="currentColor"><path d="M20 30 27.5 21a10.5 10.5 0 0 0-15 0zM8.5 15.5 12 19.5a12 12 0 0 1 16 0l3.5-4a17 17 0 0 0-23 0zM0 9.5 3.8 13.5a24 24 0 0 1 32.4 0L40 9.5a30 30 0 0 0-40 0z"/></svg>
    <span class="batt"><i></i></span>
  </span>
</div>`;

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
      radial-gradient(58% 26% at 50% 40%, rgba(77,168,245,.55) 0%, rgba(77,168,245,0) 100%),
      radial-gradient(140% 80% at 50% -20%, #2563EB 0%, #1740B5 34%, #0E2470 62%, #050B24 100%);
    font-family: Geist, -apple-system, system-ui, sans-serif;
    display: flex; flex-direction: column; align-items: center; padding: 96px 70px 0;
  }
  body::before { content: ""; position: absolute; inset: 0; background: ${NOISE};
    opacity: .085; mix-blend-mode: overlay; pointer-events: none; z-index: 1; }
  .kicker {
    color: #fff; font-size: 27px; font-weight: 700; letter-spacing: .16em;
    text-transform: uppercase; padding: 14px 28px; border-radius: 999px;
    background: rgba(255,255,255,.12); border: 2px solid rgba(255,255,255,.26);
    margin-bottom: 32px; position: relative; z-index: 2;
  }
  h1 { color: #fff; font-size: 122px; line-height: .98; font-weight: 800;
       letter-spacing: -.045em; text-align: center; white-space: pre-line; position: relative; z-index: 2;
       text-shadow: 0 6px 40px rgba(0,0,0,.25); }
  h1 em { font-style: normal; color: #9DD0FF; }
  p  { color: rgba(255,255,255,.80); font-size: 39px; line-height: 1.3; font-weight: 500;
       text-align: center; margin-top: 26px; max-width: 940px; letter-spacing: -.012em; position: relative; z-index: 2; }

  /* ── The phone ──────────────────────────────────────────────────────────
     Three nested shells, which is how a real one is built and the only way the
     edge reads correctly: titanium rail → black bezel → glass. */
  .phone { position: absolute; top: ${TOP}px; left: ${(W - BODY_W) / 2}px;
       width: ${BODY_W}px; height: ${BODY_H}px; border-radius: ${R_BODY}px;
       padding: ${RAIL}px; z-index: 3;
       /* Brushed natural titanium. The two bright bands near the vertical
          edges are the whole trick — that specular catch is what the eye reads
          as metal at thumbnail size, and a flat grey never does. */
       background: linear-gradient(96deg,
         #6f6f76 0%, #9fa0a8 3%, #d8d9e0 7%, #f2f3f7 10%, #b9bac2 15%,
         #85868d 30%, #74757c 50%, #85868d 70%, #b9bac2 85%,
         #f2f3f7 90%, #d8d9e0 93%, #9fa0a8 97%, #6f6f76 100%);
       box-shadow:
         0 -20px 120px -20px rgba(0,0,0,.55),
         0 70px 150px -40px rgba(0,0,0,.85),
         0 24px 60px -24px rgba(0,0,0,.7),
         0 0 0 1px rgba(255,255,255,.16);
  }
  /* A soft pool of shadow where the device meets the art, so it sits ON the
     background instead of floating in front of it. */
  .phone::after { content: ""; position: absolute; left: 8%; right: 8%;
       bottom: -34px; height: 70px; border-radius: 50%; z-index: -1;
       background: radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.55), rgba(0,0,0,0) 70%); }
  .bezel { width: 100%; height: 100%; border-radius: ${R_BODY - RAIL}px;
       padding: ${BEZEL}px; background: #05060a;
       box-shadow: inset 0 0 0 1px rgba(255,255,255,.05); }
  .screen { width: 100%; height: 100%; border-radius: ${R_GLASS}px;
       overflow: hidden; position: relative; background: ${f.barBg || "#000"}; }
  .screen img { position: absolute; left: 0; top: ${(f.bar.overlay ? 0 : BAR) - f.y * scale}px;
       width: ${GLASS_W}px; height: ${srcH * scale}px; display: block; }

  /* Side buttons, in their real places: Action button and the volume pair on
     the left, power and Camera Control on the right. */
  .btn { position: absolute; background: linear-gradient(90deg, #5f6067, #9a9ba3 40%, #6c6d74);
       width: ${RAIL + 5}px; border-radius: 3px; z-index: -1;
       box-shadow: 0 1px 2px rgba(0,0,0,.5); }
  .btn.action { left: ${-(RAIL + 3)}px; top: ${Math.round(BODY_H * 0.145)}px; height: ${Math.round(BODY_H * 0.032)}px; }
  .btn.vup    { left: ${-(RAIL + 3)}px; top: ${Math.round(BODY_H * 0.205)}px; height: ${Math.round(BODY_H * 0.058)}px; }
  .btn.vdn    { left: ${-(RAIL + 3)}px; top: ${Math.round(BODY_H * 0.277)}px; height: ${Math.round(BODY_H * 0.058)}px; }
  .btn.pwr    { right: ${-(RAIL + 3)}px; top: ${Math.round(BODY_H * 0.232)}px; height: ${Math.round(BODY_H * 0.088)}px; }
  .btn.cam    { right: ${-(RAIL + 2)}px; top: ${Math.round(BODY_H * 0.372)}px; height: ${Math.round(BODY_H * 0.036)}px;
       width: ${RAIL + 4}px; background: linear-gradient(90deg, #4a4b51, #8d8e96 40%, #5a5b61); }

  /* Status bar, sized from iOS metrics (54pt tall, 17pt time) so it matches
     what the capture would have had. */
  .bar { position: absolute; top: 0; left: 0; right: 0; height: ${BAR}px; z-index: 2;
       display: flex; align-items: center; justify-content: space-between;
       padding: ${Math.round(6 * scale)}px ${Math.round(74 * scale * 1.35)}px 0 ${Math.round(84 * scale * 1.35)}px;
       font-size: ${Math.round(51 * scale)}px; font-weight: 700; letter-spacing: -.02em; }
  .bar .right { display: flex; align-items: center; gap: ${Math.round(18 * scale * 1.35)}px; }
  .bar svg { width: ${Math.round(46 * scale * 1.35)}px; height: ${Math.round(30 * scale * 1.35)}px; }
  .batt { display: inline-block; width: ${Math.round(74 * scale * 1.35)}px; height: ${Math.round(36 * scale * 1.35)}px;
       border: 3px solid currentColor; border-radius: 8px; padding: 3px; opacity: .95; position: relative; }
  .batt i { display: block; width: 100%; height: 100%; background: currentColor; border-radius: 3px; }
  .batt::after { content: ""; position: absolute; right: -8px; top: 7px; width: 5px; height: 10px;
       background: currentColor; border-radius: 0 3px 3px 0; }

  /* Dynamic Island — 125 x 36.7pt, 11pt down. It is the most recognisable part
     of the device, which is why the pop-outs were moved to the sides rather
     than left sitting on top of it as they were in v4. */
  .island { position: absolute; top: ${ISLAND_TOP}px; left: 50%; transform: translateX(-50%);
       width: ${ISLAND_W}px; height: ${ISLAND_H}px; background: #000;
       border-radius: ${ISLAND_H / 2}px; z-index: 6;
       box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); }
  /* The camera lens, just visible in the island's right side, like the real one. */
  .island::after { content: ""; position: absolute; right: ${Math.round(ISLAND_H * 0.22)}px; top: 50%;
       transform: translateY(-50%); width: ${Math.round(ISLAND_H * 0.42)}px; height: ${Math.round(ISLAND_H * 0.42)}px;
       border-radius: 50%; background: radial-gradient(circle at 35% 30%, #2b3440, #0a0d12 70%);
       box-shadow: inset 0 0 0 1px rgba(120,160,220,.18); }

  .home { position: absolute; bottom: ${HOME_BOTTOM}px; left: 50%; transform: translateX(-50%);
       width: ${HOME_W}px; height: ${HOME_H}px; border-radius: ${HOME_H}px; z-index: 4;
       background: ${f.bar.fg === "#fff" ? "rgba(255,255,255,.62)" : "rgba(0,0,0,.34)"}; }

  /* Glass. A single diagonal sheen across the top-left, kept low enough that it
     never fights the app underneath. Without it the screen reads as printed
     paper rather than something lit. */
  .glare { position: absolute; inset: 0; z-index: 3; pointer-events: none;
       background: linear-gradient(122deg,
         rgba(255,255,255,.16) 0%, rgba(255,255,255,.07) 15%,
         rgba(255,255,255,.02) 27%, rgba(255,255,255,0) 38%); }

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
  .stat .lbl { font-size: 32px; color: #6b7280; font-weight: 600; }
  .stat > b { font-size: 108px; font-weight: 800; letter-spacing: -.04em; line-height: 1.02; }
  .stat small { font-size: 30px; color: #6b7280; font-weight: 500; }
  .stat small b { color: #111; font-weight: 700; }
  .chip { display: flex; align-items: center; gap: 20px; padding: 26px 40px; border-radius: 999px;
       background: #fff; font-size: 38px; font-weight: 600; color: #111;
       box-shadow: 0 40px 80px -20px rgba(0,0,0,.6), 0 0 0 2px rgba(255,255,255,.4); }
  .chip.big { font-size: 44px; padding: 32px 52px; }
  .chip.dark { background: #111; color: #fff; }
  .chip.blue { background: #2563EB; color: #fff; }
  .chip.wallet { background: #000; color: #fff; font-size: 42px; padding: 30px 54px; }
  .chip b { font-weight: 800; }
  .chip .on { width: 22px; height: 22px; border-radius: 50%; background: #4ADE80; }
  .badge { display: inline-block; padding: 16px 28px; border-radius: 999px; background: #EFF6FF;
       color: #1D4ED8; font-size: 30px; font-weight: 700; border: 2px solid #DBEAFE; }
  .loc { width: 860px; padding: 38px 46px; display: flex; flex-direction: column; gap: 14px; }
  .loc .row { display: flex; justify-content: space-between; align-items: baseline; }
  .loc .row b { font-size: 46px; font-weight: 700; letter-spacing: -.02em; }
  .loc .row span { font-size: 34px; color: #4b5563; font-weight: 500; }
  .loc .row span b { font-size: 40px; color: #111; }
  .loc .split { font-size: 32px; color: #6b7280; font-weight: 500; }
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
<div class="phone">
  <span class="btn action"></span><span class="btn vup"></span><span class="btn vdn"></span>
  <span class="btn pwr"></span><span class="btn cam"></span>
  <div class="bezel"><div class="screen">
    <img src="file://${process.cwd()}/${RAW}/${f.src}.png">
    ${statusBar(f.bar, f.barBg)}
    <div class="glare"></div>
    <div class="home"></div>
    <div class="island"></div>
  </div></div>
</div>
${f.pops.map((p) => p.html
  .replace('class="pop chip"', `class="pop chip${p.dark ? " dark" : ""}${p.blue ? " blue" : ""}${p.wallet ? " wallet" : ""}${p.big ? " big" : ""}"`)
  .replace(/class="pop ([^"]*)"/, (_m, c) => `class="pop ${c}" style="${popStyle(p)}"`)).join("\n")}`;

console.log(`device: glass ${GLASS_W}x${GLASS_H}, body ${BODY_W}x${BODY_H} (${(BODY_H / BODY_W).toFixed(4)}:1, real 2.1005:1)`);
console.log(`        top ${TOP}, bottom gap ${BOTTOM_GAP}, shows ${SRC_VISIBLE} of ${SRC_H} capture px`);
if (BOTTOM_GAP < 0) console.error("  ! the device runs off the canvas — reduce GLASS_W or TOP");

let bad = 0;
for (const f of FRAMES) {
  if (ONLY && !ONLY.includes(f.n)) continue;
  const srcH = pngHeight(`${RAW}/${f.src}.png`);
  if (f.y + SRC_VISIBLE > srcH) {
    console.error(`  ! ${f.n} would run ${f.y + SRC_VISIBLE - srcH}px past the end of ${f.src} (${srcH})`);
    bad++;
  }
  // Sampled a few rows below the scroll position, i.e. the first page pixel the
  // status bar will sit against. Falls back to the hand-set colour if the PNG
  // is a shape the reader doesn't handle.
  f.barBg = f.bar.overlay ? null : (topColour(`${RAW}/${f.src}.png`, f.y + 8) ?? f.bar.bg);
  if (!f.bar.overlay && f.barBg !== f.bar.bg) console.log(`   ${f.n} bar ${f.bar.bg} → ${f.barBg} (measured)`);
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
