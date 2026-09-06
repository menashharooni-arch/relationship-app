// Capture real app screens for the App Store listing.
//
// The old screenshot set could not show Swift Links, the Signature, or the
// contacts CRM because every one of those needs a signed-in session, and the
// earlier attempt to reach them headlessly failed. This does what the native
// flow harness already does: creates a throwaway Supabase account, seeds it
// with realistic content, drives a real browser through a real login, captures
// the screens, and deletes everything in a finally block.
//
//   node capture.mjs
//
// ⚠️ It writes to whatever project .env.local points at. Every row it creates
// is removed at the end, including on failure.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const ROOT = "/Users/menashharooni/Projects/relationship-app";
const OUT = process.env.OUT || "app-store/screenshots/_raw";
const BASE = process.env.BASE || "https://swiftcard.me";
mkdirSync(OUT, { recursive: true });

const env = readFileSync(`${ROOT}/.env.local`, "utf8");
const g = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const SB = g("NEXT_PUBLIC_SUPABASE_URL"), SVC = g("SUPABASE_SERVICE_ROLE_KEY");

const adm = (p, i) => fetch(SB + p, {
  ...i,
  headers: { apikey: SVC, Authorization: "Bearer " + SVC, "Content-Type": "application/json", ...(i?.headers ?? {}) },
});

const stamp = Date.now().toString().slice(-8);
const uname = `alex-rivera-${stamp}`;
const email = `shots-${stamp}@swiftcard-test.invalid`;
const password = `Shot!aA1${Math.random().toString(36).slice(2)}`;
let userId = null, cardId = null, browser;

// Realistic content. A screenshot with "Test User / Lorem Ipsum" in it reads as
// unfinished software; every value here is the kind a real user would have.
// Lena Brooks — the persona the marketing site's own hero showcase already
// uses, so the App Store set, the website and the demo card all tell one
// story. Her headshot ships in this repo (public/showcase/lena.jpg), which is
// why the screenshots can show a real face without licensing a stock photo.
const PHOTO = "https://swiftcard.me/showcase/lena.jpg";
const ACCENT = "#111827";

const CARD = {
  name: "Lena Brooks", title: "Photographer", company: "Lena Brooks Photography",
  phone: "(503) 555-0143", email: "hello@lenabrooks.photo", website: "lenabrooks.photo",
  linkedin: "lenabrooks", instagram: "lenabrooks.photo", tiktok: "lenabrooks",
  // photo-first puts a full-height photo beside the details panel — the most
  // designed of the templates, and the only one that treats a headshot as the
  // subject rather than a small avatar. Chosen by rendering all six against
  // each other (scripts/appstore-explore.mjs) rather than from the preset list.
  template: "photo-first",
};

const BIO = "Weddings, portraits and brand shoots — natural light, real moments. Portland, OR.";

// Card design: the headshot fills the left, and the panel behind the details
// is the template's own Royal Violet preset rather than flat white.
// Onyx panel behind the details, ink buttons. The violet gradient this
// replaces fought the photo and the page around it; black lets the headshot be
// the only colour on the card.
const CARD_DESIGN = {
  photoUrl: PHOTO,
  accentColor: ACCENT,
  bgColor: "#0a0a0a",
  textColor: "#ffffff",
  bio: BIO,
};

// A links page with something to look at: one featured tile, a pair in the
// grid, and slim rows for the plain links — the three tile sizes the layout
// engine supports, so the page shows its range instead of one shape repeated.
const LINKS = [
  { emoji: "🎬", label: "Watch the 2026 wedding reel", url: "https://lenabrooks.photo/reel", size: "compact" },
  { emoji: "📸", label: "Portfolio", url: "https://lenabrooks.photo/portfolio", size: "compact" },
  { emoji: "💍", label: "Wedding packages", url: "https://lenabrooks.photo/weddings", size: "compact" },
  { emoji: "🌅", label: "Mini sessions", url: "https://lenabrooks.photo/minis", size: "compact" },
  { emoji: "📅", label: "Check my 2026 availability", url: "https://lenabrooks.photo/book", size: "compact" },
  { emoji: "✉️", label: "Join the newsletter", url: "https://lenabrooks.photo/news", size: "compact" },
];

const LEADS = [
  { name: "Jordan Rivera", company: "Rivera Design Co.", email: "jordan.rivera@example.com", phone: "(415) 555-0110", tags: ["qr"], source: "qr_code" },
  { name: "Marcus Webb", company: "Webb & Co.", email: "marcus.webb@example.com", phone: "(415) 555-0121", tags: [], source: "direct_link" },
  { name: "Priya Nair", company: "Lumen Health", email: "priya.nair@example.com", phone: "(415) 555-0132", tags: ["nfc"], source: "nfc_tap" },
  { name: "Sofia Delgado", company: "Delgado Partners", email: "sofia@example.com", phone: "(415) 555-0143", tags: [], source: "swift_links" },
  { name: "Tom Bergeron", company: "Harbor Financial", email: "tom.b@example.com", phone: "(415) 555-0154", tags: ["qr"], source: "qr_code" },
];

// Full-page captures stitch the page in viewport-sized bands, so anything
// position:fixed — the bottom tab bar, the help bubble — is painted ONCE at
// the first viewport's bottom edge and then sits in the middle of the tall
// image. The v2 dashboard frame shipped with the tab bar floating above the
// traffic chart for exactly that reason. Hide fixed chrome for full-page
// shots; viewport shots keep it, since there it sits where it belongs.
const HIDE_FIXED = ".sc-tabbar, .sc-help-bubble { display: none !important; }";
const shot = async (page, name, { full = false, wait = 1200 } = {}) => {
  await page.waitForTimeout(wait);
  if (full) await page.addStyleTag({ content: HIDE_FIXED });
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  if (full) await page.evaluate(() => document.querySelectorAll("style").forEach((s) => { if (s.textContent.includes("sc-tabbar, .sc-help-bubble")) s.remove(); })).catch(() => {});
  console.log("  captured", name);
};

try {
  console.log("seeding…");
  const u = await (await adm("/auth/v1/admin/users", {
    method: "POST", body: JSON.stringify({ email, password, email_confirm: true }),
  })).json();
  userId = u.id;
  if (!userId) throw new Error("no user id: " + JSON.stringify(u).slice(0, 200));

  await adm("/rest/v1/profiles", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      id: userId, username: uname, name: CARD.name, email, plan: "pro",
      template: CARD.template,
      photo_url: PHOTO,
      customization: { bio: BIO, photoUrl: PHOTO, _aiConsent: "accepted" },
    }),
  });

  const card = await (await adm("/rest/v1/cards", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: userId, username: uname, ...CARD,
      customization: {
        ...CARD_DESIGN,
        links: LINKS,
        // A cover photo instead of the initials block, on a dark Look so the
        // tiles and the brand-coloured social chips carry the page.
        // "aura" is the one Look that renders the social chips MONOTONE and
        // carries a deep plum gradient behind the whole page — the brand-
        // coloured chips were the loudest thing on the old version.
        linkLook: "aura",
        linkHeroStyle: "cover",
        linkHeroContent: "photo",
        linkIconShape: "circle",
        linkIconFill: "accent",
        youtube: "lenabrooks",
        facebook: "lenabrooks.photo",
      },
    }),
  })).json();
  cardId = card?.[0]?.id;

  // Analytics with zeros in it sells nothing. Seed a fortnight of views across
  // hours, days, sources and towns so the Traffic chart, the Locations tab and
  // the counters all render like a real account's.
  const TOWNS = ["San Francisco, CA", "Oakland, CA", "San Jose, CA", "Sacramento, CA", "Los Angeles, CA", "Portland, OR"];
  const SOURCES = ["qr_code", "direct_link", "nfc_tap", "swift_links", "email_signature"];
  const views = [];
  for (let d = 0; d < 14; d++) {
    const n = d === 0 ? 31 : d === 1 ? 22 : 6 + ((d * 7) % 9);
    for (let i = 0; i < n; i++) {
      const at = new Date(Date.now() - d * 86400000 - ((i * 97) % 20) * 3600000 - (i % 13) * 60000);
      views.push({
        username: uname, viewed_at: at.toISOString(),
        location: TOWNS[(d + i) % TOWNS.length],
        source: SOURCES[(d * 3 + i) % SOURCES.length],
        visitor_id: `shot-${d}-${i}`,
      });
    }
  }
  await adm("/rest/v1/card_views", { method: "POST", body: JSON.stringify(views) });
  console.log("  seeded", views.length, "views");

  await adm("/rest/v1/leads", {
    method: "POST",
    body: JSON.stringify(LEADS.map((l) => ({ ...l, card_owner: uname }))),
  });
  console.log("  seeded", uname);

  browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 3,
    colorScheme: "dark",
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  // Render as the native iOS shell, not mobile Safari. Without this the app
  // shows its web presentation: no "Add to Apple Wallet" (that button is
  // native-only), and the marketing chrome rules differ. The shim must be in
  // place BEFORE first paint, and it must fake window.webkit too — Capacitor
  // derives the platform from the message-handler bridge, so faking
  // isNativePlatform alone fools the boot script but not the components.
  await ctx.addInitScript(() => {
    window.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
    window.Capacitor = {
      isNativePlatform: () => true, isNative: true, platform: "ios",
      getPlatform: () => "ios", isPluginAvailable: () => false, Plugins: {},
    };
  });

  const page = await ctx.newPage();

  // Public screens first — no session needed, and they are the ones a brand
  // new user actually sees.
  console.log("public screens…");
  const pubCtx = await browser.newContext({
    viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const pub = await pubCtx.newPage();
  await pub.goto(`${BASE}/${uname}`, { waitUntil: "networkidle" });
  await shot(pub, "public-card", { full: true });
  await pub.goto(`${BASE}/links/${uname}`, { waitUntil: "networkidle" });
  await shot(pub, "swift-links", { full: true });
  await pubCtx.close();

  // Signed-in screens.
  console.log("logging in…");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  // NOT :has-text("Sign in") — that matches the Sign in / Create account TAB
  // above the form, so the first run clicked a tab and captured six copies of
  // the login screen. The submit button is the one carrying the arrow.
  await page.click('button:has-text("Sign in \u2192")');
  await page.waitForURL(/dashboard|onboarding|welcome/, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(3500);
  console.log("  landed on", page.url());
  if (/\/login/.test(page.url())) throw new Error("login did not complete");

  // A first-run tour or splash can sit over every screen; dismiss whatever is
  // there rather than screenshotting a modal.
  for (const label of ["Allow", "Skip", "Skip tour", "Got it", "Maybe later", "Close", "Done"]) {
    const b = page.locator(`button:has-text("${label}")`).first();
    if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await page.waitForTimeout(400); }
  }
  await page.keyboard.press("Escape").catch(() => {});

  for (const [name, path, full] of [
    ["contacts", "/contacts", true],
    ["share", "/share", true],
  ]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
    await shot(page, name, { full });
  }

  // Dashboard twice: as it lands, and with Traffic switched to Month so the
  // analytics frame shows a fortnight of bars instead of today's handful.
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" }).catch(() => {});
  // The shell paints a splash over the first viewport. A full-page shot taken
  // too early bakes that overlay across the top third of the image, which is
  // where the card and the traffic counters live.
  await page.waitForTimeout(7000);
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await shot(page, "dashboard", { full: true, wait: 2500 });
  await shot(page, "dashboard-top", { full: false, wait: 300 });
  console.log("  wallet button present:", await page.locator('text=Add to Apple Wallet').count().catch(() => 0));
  // "Add to Apple Wallet" is inside the share panel, not on the dashboard root.
  const more = page.locator('button:has-text("Other ways to share")').first();
  if (await more.count().catch(() => 0)) {
    await more.click().catch(() => {});
    await page.waitForTimeout(2200);
    console.log("  wallet in share panel:", await page.locator('text=Add to Apple Wallet').count().catch(() => 0));
    await shot(page, "ways-to-share", { full: false });
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(600);
  } else {
    console.log("  ! 'Other ways to share' not found");
  }

  const month = page.locator('button:has-text("Month")').first();
  if (await month.count().catch(() => 0)) {
    await month.click().catch(() => {});
    await page.waitForTimeout(2000);
    await shot(page, "dashboard-month", { full: true });
  }

  // The Signature is only a button until you open it — the picture of the card
  // that goes in an email lives behind "Preview & copy".
  await page.goto(`${BASE}/share`, { waitUntil: "networkidle" }).catch(() => {});
  const sig = page.locator('button:has-text("Preview & copy")').first();
  if (await sig.count().catch(() => 0)) {
    await sig.click().catch(() => {});
    await page.waitForTimeout(2500);
    await shot(page, "signature", { full: false });
  } else {
    console.log("  ! signature button not found");
  }

  // A contact opened up, showing the follow-up automations.
  await page.goto(`${BASE}/contacts`, { waitUntil: "networkidle" }).catch(() => {});
  const lead = page.locator('text=Jordan Rivera').first();
  if (await lead.count().catch(() => 0)) {
    await lead.click().catch(() => {});
    await page.waitForTimeout(2500);
    // The follow-up automations live behind the second tab. Without this the
    // frame promises AI follow-up and shows an empty activity list.
    const tab = page.locator('button:has-text("Contact info")').first();
    if (await tab.count().catch(() => 0)) { await tab.click().catch(() => {}); await page.waitForTimeout(1800); }
    await shot(page, "contact-detail", { full: true });
  } else {
    console.log("  ! contact row not found");
  }
  console.log("done");
} catch (e) {
  console.error("FAILED:", e.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  console.log("cleaning up…");
  try {
    await adm(`/rest/v1/card_views?username=eq.${uname}`, { method: "DELETE" });
    await adm(`/rest/v1/leads?card_owner=eq.${uname}`, { method: "DELETE" });
    if (cardId) await adm(`/rest/v1/cards?id=eq.${cardId}`, { method: "DELETE" });
    if (userId) {
      await adm(`/rest/v1/profiles?id=eq.${userId}`, { method: "DELETE" });
      await adm(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
    }
    console.log("  removed throwaway account", uname);
  } catch (e) {
    console.error("  CLEANUP FAILED — remove manually:", uname, userId, e.message);
  }
}
