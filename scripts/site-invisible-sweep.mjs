// READ-ONLY site-wide sweep for the "rendered but invisible" bug class:
// collapsed CardScalers, invisible preview frames, unresolved Suspense stubs,
// broken images, and interactive demos that don't paint. Real painting browser.
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  pathToFileURL("C:/Users/Malve/relationship-app/node_modules/playwright/index.mjs").href
);
const BASE = "https://swiftcard.me";
const PAGES = ["/", "/pricing", "/templates", "/compare", "/testimonials", "/preview", "/cards/new", "/login", "/checkout?plan=pro", "/upgrade", "/privacy", "/contact"];

const browser = await chromium.launch();

async function sweep(page) {
  return page.evaluate(() => {
    const bad = [];
    [...document.querySelectorAll("div")].forEach((el) => {
      if (((getComputedStyle(el).contain) || "").includes("size")) {
        const r = el.getBoundingClientRect();
        if (r.width < 5 || r.height < 5) bad.push("scaler-collapsed:" + (el.className || "").slice(0, 30));
      }
    });
    [...document.querySelectorAll("[data-preview-locked]")].forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 5 || r.height < 5) bad.push("preview-frame-collapsed");
    });
    bad.push(...[...document.querySelectorAll("div[hidden][id^='S:']")].map(() => "unresolved-suspense"));
    [...document.querySelectorAll("img")].forEach((img) => {
      if (img.complete && img.naturalWidth === 0 && img.getBoundingClientRect().width > 0)
        bad.push("broken-img:" + (img.src || "").split("/").pop().slice(0, 40));
    });
    return bad;
  });
}

for (const path of PAGES) {
  for (const [label, vp] of [["desktop", { width: 1280, height: 800 }], ["phone", { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 80)));
    try {
      await page.goto(BASE + path, { waitUntil: "load", timeout: 45000 });
      await page.waitForTimeout(1200);
      const bad = await sweep(page);
      // homepage: also open all three mini-builders and type, then sweep again
      if (path === "/") {
        for (const btnText of ["See how your card would look", "See how your Swift Signature would look", "See how your SwiftLink would look"]) {
          const btn = page.locator(`button:has-text("${btnText}")`).first();
          if (await btn.count()) {
            await btn.scrollIntoViewIfNeeded();
            await btn.click();
            await page.waitForTimeout(400);
            const nameInput = page.locator('input[placeholder="Alex Morgan"]').first();
            if (await nameInput.count()) await nameInput.fill("Sweep Test");
            await page.waitForTimeout(400);
            const inModal = await sweep(page);
            const nameShown = await page.evaluate(() =>
              [...document.querySelectorAll("*")].some((el) => el.children.length === 0 && /Sweep Test/.test(el.textContent || "") && el.getBoundingClientRect().width > 0)
            );
            if (!nameShown) inModal.push("builder-preview-not-updating");
            if (inModal.length) bad.push(`[${btnText.slice(16, 30)}] ` + inModal.join(","));
            const close = page.locator('button[aria-label="Close"]').first();
            if (await close.count()) await close.click();
            await page.waitForTimeout(200);
          }
        }
      }
      console.log(`${label.padEnd(7)} ${path.padEnd(18)} ${bad.length ? "FINDINGS: " + bad.join(" | ") : "clean"}${errors.length ? "  JSERR: " + errors.join(";") : ""}`);
    } catch (e) {
      console.log(`${label.padEnd(7)} ${path.padEnd(18)} LOAD-FAILED ${String(e.message).slice(0, 60)}`);
    }
    await ctx.close();
  }
}
await browser.close();
