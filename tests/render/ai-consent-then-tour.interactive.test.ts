import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "esbuild";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Browser, Page, Route } from "playwright";
import { appCss, launchBrowser } from "./harness";

// ─────────────────────────────────────────────────────────────────────────────
// IN THE APP: LAND ON THE DASHBOARD → AI PERMISSION → ALLOW → THE TOUR.
//
// Owner, 2026-09-18: "For every single account with any type of plan that's
// created, the AI consent form should pop up only once they land in their
// dashboard. They press Allow and then after that the tour comes up." (iPhone
// app only.) The plan never reaches this code: the server's `ready` answer is
// what every plan shares, so it is faked here and the rest is the real thing.
//
// The REAL components, mounted together in real Chromium on a page served at
// /dashboard?welcome=1&tour=1 — GlobalAiConsent (root layout) → AiConsentGate,
// TourAutoStart and TourBanner (dashboard) — with real timers. Only three
// things are faked: next/navigation (no Next router here), the iOS bridge
// (window.webkit…bridge, which is how the app is detected), and the consent
// API's answer. "The tour started" is read from what startTour writes
// (sessionStorage sc_tour_running) — the GuidedTour host itself is not the
// subject here.
// ─────────────────────────────────────────────────────────────────────────────

const ORIGIN = "http://app.swiftcard.test";

const NAV_STUB = `
  export const usePathname = () => location.pathname;
  export const useSearchParams = () => new URLSearchParams(location.search);
  export const useRouter = () => ({ push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} });
`;

const ENTRIES: Record<string, string> = {
  dashboard: `
    import { createRoot } from "react-dom/client";
    import { createElement as h } from "react";
    import GlobalAiConsent from "@/components/GlobalAiConsent";
    import TourAutoStart from "@/components/TourAutoStart";
    import TourBanner from "@/components/TourBanner";
    createRoot(document.getElementById("root")!).render(
      h("div", null, h(TourBanner), h(TourAutoStart), h(GlobalAiConsent)),
    );
  `,
  admin: `
    import { createRoot } from "react-dom/client";
    import { createElement as h } from "react";
    import GlobalAiConsent from "@/components/GlobalAiConsent";
    import AdminTourAutoStart from "@/components/office/AdminTourAutoStart";
    createRoot(document.getElementById("root")!).render(h("div", null, h(AdminTourAutoStart), h(GlobalAiConsent)));
  `,
};

const COPY = { title: "Before you use AI features", what: ["A photo"], who: "Sent to Google.", control: "You can say no." };

let browser: Browser;
let tmp: string;
const bundles: Record<string, string> = {};
let css = "";

beforeAll(async () => {
  browser = await launchBrowser();
  css = await appCss();
  const cache = resolve("node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  tmp = mkdtempSync(join(cache, "ai-consent-tour-"));
  writeFileSync(join(tmp, "nav-stub.ts"), NAV_STUB);
  for (const [name, src] of Object.entries(ENTRIES)) {
    writeFileSync(join(tmp, `${name}.tsx`), src);
    const out = await build({
      entryPoints: [join(tmp, `${name}.tsx`)], bundle: true, write: false, format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' },
      alias: { "@": resolve("src"), "next/navigation": join(tmp, "nav-stub.ts") },
      loader: { ".svg": "text" },
      banner: { js: "var process = { env: { NODE_ENV: \"production\" } };" },
    });
    bundles[name] = out.outputFiles[0].text;
  }
}, 180_000);
afterAll(async () => { await browser?.close(); if (tmp) rmSync(tmp, { recursive: true, force: true }); });

type Opts = {
  native: boolean;
  /** The consent API's GET answer, or a status to fail with. */
  consent?: { consent: "unset" | "accepted" | "declined"; ready?: boolean; provider?: string | null } | number;
  path?: string;
  entry?: "dashboard" | "admin";
};

async function open(o: Opts): Promise<{ page: Page; consentReads: () => number; posts: string[] }> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  if (o.native) await ctx.addInitScript(() => { (window as unknown as { webkit: unknown }).webkit = { messageHandlers: { bridge: { postMessage() {} } } }; });
  const page = await ctx.newPage();
  let reads = 0;
  const posts: string[] = [];
  await page.route(`${ORIGIN}/api/account/ai-consent`, async (route: Route) => {
    if (route.request().method() === "POST") {
      posts.push(route.request().postData() ?? "");
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    reads++;
    // A realistic round trip: longer than the old 0.5s tour start, which is
    // exactly the race that put the tour and the sheet on screen together.
    await new Promise((r) => setTimeout(r, 900));
    if (typeof o.consent === "number") return route.fulfill({ status: o.consent, body: "{}" });
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ready: true, provider: "Google", copy: COPY, ...(o.consent ?? { consent: "unset" }) }),
    });
  });
  const path = o.path ?? "/dashboard?welcome=1&tour=1";
  await page.route(`${ORIGIN}${path.split("?")[0]}*`, (route) => route.fulfill({
    status: 200, contentType: "text/html",
    body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head>
           <body class="sc-app bg-gray-950"><div id="root"></div><script>${bundles[o.entry ?? "dashboard"]}</script></body></html>`,
  }));
  await page.goto(`${ORIGIN}${path}`);
  return { page, consentReads: () => reads, posts };
}

const sheet = (p: Page) => p.locator('[aria-labelledby="ai-consent-title"]');
const tourStarted = (p: Page, key = "sc_tour_running") => p.evaluate((k) => sessionStorage.getItem(k) === "1", key);
const banner = (p: Page) => p.getByText("Take a quick tour").isVisible();

describe("a brand-new account in the app", () => {
  it("sees the AI permission sheet first, the tour waits, and Allow starts the tour", async () => {
    const { page, posts } = await open({ native: true });
    try {
      await sheet(page).waitFor({ timeout: 10_000 });
      // Well past the old 0.5s start and the banner's 1.5s.
      await page.waitForTimeout(5000);
      expect(await tourStarted(page), "the tour started underneath the permission sheet").toBe(false);
      expect(await banner(page), "the tour invite banner appeared behind the sheet").toBe(false);

      await page.getByRole("button", { name: "Allow", exact: true }).click();
      await page.waitForFunction(() => sessionStorage.getItem("sc_tour_running") === "1", null, { timeout: 3000 });
      expect(await sheet(page).isVisible()).toBe(false);
      expect(posts).toEqual([JSON.stringify({ decision: "accepted" })]);
    } finally { await page.context().close(); }
  });

  it("gets the tour after Don't allow too", async () => {
    const { page, posts } = await open({ native: true });
    try {
      await sheet(page).waitFor({ timeout: 10_000 });
      await page.getByRole("button", { name: "Don't allow" }).click();
      await page.waitForFunction(() => sessionStorage.getItem("sc_tour_running") === "1", null, { timeout: 3000 });
      expect(posts).toEqual([JSON.stringify({ decision: "declined" })]);
    } finally { await page.context().close(); }
  });
});

describe("nothing to ask — the tour is not held up", () => {
  it("an account that already allowed gets the tour without a sheet", async () => {
    const { page } = await open({ native: true, consent: { consent: "accepted" } });
    try {
      await page.waitForFunction(() => sessionStorage.getItem("sc_tour_running") === "1", null, { timeout: 4000 });
      expect(await sheet(page).isVisible()).toBe(false);
    } finally { await page.context().close(); }
  });

  it("a failed consent read does not strand the tour", async () => {
    const { page } = await open({ native: true, consent: 500 });
    try {
      await page.waitForFunction(() => sessionStorage.getItem("sc_tour_running") === "1", null, { timeout: 4000 });
    } finally { await page.context().close(); }
  });

  it("the website never asks and starts the tour as before", async () => {
    const { page, consentReads } = await open({ native: false });
    try {
      // No App Store listing in this bundle, so the web's own App Store popup
      // (which the tour also waits for) is not in play.
      await page.waitForFunction(() => sessionStorage.getItem("sc_tour_running") === "1", null, { timeout: 3000 });
      expect(await sheet(page).isVisible()).toBe(false);
      expect(consentReads(), "the website must not even fetch the consent state").toBe(0);
    } finally { await page.context().close(); }
  });
});

describe("an Office owner opening the admin console for the first time in the app", () => {
  it("is asked first, then the admin tour starts", async () => {
    const { page } = await open({ native: true, path: "/office/admin", entry: "admin" });
    try {
      await sheet(page).waitFor({ timeout: 10_000 });
      await page.waitForTimeout(3000);
      expect(await tourStarted(page, "sc_admin_tour_running")).toBe(false);
      await page.getByRole("button", { name: "Allow", exact: true }).click();
      await page.waitForFunction(() => sessionStorage.getItem("sc_admin_tour_running") === "1", null, { timeout: 3000 });
    } finally { await page.context().close(); }
  });
});
