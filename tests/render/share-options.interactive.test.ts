import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "esbuild";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Browser, Page } from "playwright";
import { appCss, launchBrowser } from "./harness";

// INTERACTION test for the reworked share options.
//
// Everything else about this change is a source scan, and a source scan cannot
// tell you what is actually inside the modal once it opens, in what order, or
// whether the card-PNG button appears when it should. This bundles the REAL
// MoreShareOptions with esbuild, hydrates it in headless Chromium with the app's
// compiled Tailwind, and clicks it.
//
// It also pins the property the whole design rests on: the dashboard renders
// its card panel TWICE with one copy display:none, so each copy must resolve to
// ITS OWN card. If a modal ever reached the hidden copy, the PNG would come out
// blank — a bug that leaves no trace in source.

let browser: Browser;
let bundle: string;
let tmp: string;

const URL = "https://swiftcard.me/card/alex-morgan";

beforeAll(async () => {
  browser = await launchBrowser();
  // INSIDE the project: esbuild resolves bare imports from the importing file's
  // directory upward, so stubs in a system temp dir cannot find react at all.
  const cache = resolve("node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  tmp = mkdtempSync(join(cache, "shareopts-"));

  writeFileSync(join(tmp, "entry.tsx"), `
    import { createRoot } from "react-dom/client";
    import { createElement as h, useRef } from "react";
    import MoreShareOptions from "@/components/MoreShareOptions";
    import ScanToConnectButton from "@/components/ScanToConnectButton";
    import { CardCaptureProvider, useRegisterCardCapture, useCardCapture } from "@/components/CardCaptureContext";

    // Stands in for CardPreviewDownload: registers a real DOM node.
    function FakeCard({ id }: { id: string }) {
      const ref = useRef<HTMLDivElement>(null);
      useRegisterCardCapture({ cardRef: ref, filename: id + ".png", shareUrl: "${URL}" });
      return h("div", { ref, "data-card": id, style: { width: 40, height: 20 } }, id);
    }

    // Renders whatever filename its own provider resolved to — the isolation probe.
    function Probe({ id }: { id: string }) {
      const c = useCardCapture();
      return h("p", { id: "probe-" + id }, c ? c.filename : "NONE");
    }

    (window as any).mount = ({ withCapture, twoPanels }: any) => {
      const el = document.getElementById("root")!;
      const panel = (id: string) =>
        h(CardCaptureProvider, { key: id }, h(FakeCard, { id }), h(Probe, { id }), h(MoreShareOptions, { url: "${URL}" }));
      let tree;
      if (twoPanels) tree = h("div", null, panel("card-a"), panel("card-b"));
      else if (withCapture) tree = panel("card-a");
      else tree = h("div", null, h(Probe, { id: "card-a" }), h(MoreShareOptions, { url: "${URL}" }));
      createRoot(el).render(tree);
    };

    (window as any).mountScan = (url: string) => {
      createRoot(document.getElementById("root")!).render(h(ScanToConnectButton, { url }));
    };
  `);

  const out = await build({
    entryPoints: [join(tmp, "entry.tsx")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: { "@": resolve("src") },
  });
  bundle = out.outputFiles[0].text;
}, 240_000);

afterAll(async () => {
  await browser?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

async function mount(width: number, opts: { withCapture?: boolean; twoPanels?: boolean }): Promise<Page> {
  const css = await appCss();
  const page = await browser.newPage();
  // setViewportSize EXPLICITLY — the constructor option has silently not taken
  // in this harness before, which inverts every breakpoint assertion.
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
     <style>body{margin:0;padding:16px;background:#030712}</style></head>
     <body class="sc-app"><div id="root"></div><script>${bundle}</script></body></html>`,
  );
  await page.evaluate((o) => (window as unknown as { mount: (x: unknown) => void }).mount(o), opts);
  await page.waitForSelector("button");
  expect(await page.evaluate(() => window.innerWidth)).toBe(width);
  return page;
}

/** Open the Nth "Other ways to share" modal and report what is VISIBLE in it. */
async function openModal(page: Page, index = 0) {
  const triggers = page.locator('button:has-text("Other ways to share")');
  await triggers.nth(index).click();
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    const shown = (el: Element | null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return getComputedStyle(el).display !== "none" && r.width > 0 && r.height > 0;
    };
    // The dialog is the panel holding the "Share options" heading.
    const heading = Array.from(document.querySelectorAll("p")).find((p) => p.textContent === "Share options");
    const modal = heading?.closest("div")?.parentElement as HTMLElement | undefined;
    if (!modal) throw new Error("share modal did not open");
    // Responsive hiding means BOTH the mobile and desktop copies of a control
    // are in the DOM, one display:none. Every lookup here must therefore find
    // the VISIBLE one — taking the first match silently measured the hidden
    // copy and reported a present control as missing.
    const visibleBtn = (t: string) =>
      Array.from(modal.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes(t) && shown(b)) ?? null;
    const qrPanel =
      Array.from(modal.querySelectorAll("p")).find((p) => p.textContent === "Scan to connect" && shown(p)) ?? null;
    const top = (el: Element | null) => (el ? Math.round(el.getBoundingClientRect().top) : -1);
    const cardLink = modal.querySelector("span.text-blue-400");
    const nfc = Array.from(modal.querySelectorAll("p")).find((p) => p.textContent === "NFC card") ?? null;
    return {
      downloadCard: !!visibleBtn("Download card (PNG)"),
      downloadQr: !!visibleBtn("Download QR (PNG)"),
      qrImage: !!qrPanel,
      order: {
        cardLink: top(cardLink),
        downloadCard: top(visibleBtn("Download card (PNG)")),
        downloadQr: top(visibleBtn("Download QR (PNG)")),
        nfc: top(nfc),
      },
    };
  });
}

const MOBILE = 375;
const DESKTOP = 1280;

describe("mobile share modal: card link, download card, download QR, NFC", () => {
  it("offers BOTH downloads and no QR picture", async () => {
    const page = await mount(MOBILE, { withCapture: true });
    try {
      const m = await openModal(page);
      expect(m.downloadCard, "the card PNG download is missing").toBe(true);
      expect(m.downloadQr, "the QR PNG download is missing").toBe(true);
      expect(m.qrImage, "the QR image is still here — it moved to its own popup").toBe(false);
    } finally { await page.close(); }
  }, 90_000);

  it("in exactly the order asked for", async () => {
    const page = await mount(MOBILE, { withCapture: true });
    try {
      const { order } = await openModal(page);
      expect(order.cardLink).toBeGreaterThan(-1);
      expect(order.downloadCard).toBeGreaterThan(order.cardLink);
      expect(order.downloadQr).toBeGreaterThan(order.downloadCard);
      expect(order.nfc).toBeGreaterThan(order.downloadQr);
    } finally { await page.close(); }
  }, 90_000);
});

describe("desktop share modal is untouched", () => {
  it("keeps the QR image and does NOT gain a card download", async () => {
    const page = await mount(DESKTOP, { withCapture: true });
    try {
      const m = await openModal(page);
      expect(m.qrImage, "the desktop QR image disappeared").toBe(true);
      expect(m.downloadQr).toBe(true);
      expect(m.downloadCard, "a mobile-only control leaked onto desktop").toBe(false);
    } finally { await page.close(); }
  }, 90_000);
});

describe("without a capturable card (the /preview demo) nothing changes", () => {
  it("keeps the QR image even on mobile, and shows no dead download button", async () => {
    // /preview draws its card in an <iframe>; there is no node to rasterize, so
    // a "Download card" button there would be a guaranteed dead tap.
    const page = await mount(MOBILE, { withCapture: false });
    try {
      const m = await openModal(page);
      expect(m.qrImage).toBe(true);
      expect(m.downloadCard, "a dead download button on a page with no card").toBe(false);
      expect(m.downloadQr).toBe(true);
    } finally { await page.close(); }
  }, 90_000);
});

describe("Scan to connect (QR) opens a real QR popup", () => {
  const QR_URL = `${URL}?source=qr_code`;

  async function mountScan(): Promise<Page> {
    const css = await appCss();
    const page = await browser.newPage();
    await page.setViewportSize({ width: MOBILE, height: 900 });
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
       <style>body{margin:0;padding:16px;background:#030712}</style></head>
       <body class="sc-app"><div id="root"></div><script>${bundle}</script></body></html>`,
    );
    await page.evaluate((u) => (window as unknown as { mountScan: (u: string) => void }).mountScan(u), QR_URL);
    await page.waitForSelector("button");
    return page;
  }

  it("shows nothing until tapped", async () => {
    const page = await mountScan();
    try {
      // :text-is, not text= — the trigger's own label contains "Scan to
      // connect", so a substring match finds the button and never the panel.
      expect(await page.locator('p:text-is("Scan to connect")').count()).toBe(0);
      expect(await page.locator('button:has-text("Scan to connect (QR)")').count()).toBe(1);
    } finally { await page.close(); }
  }, 90_000);

  it("tapping it renders a scannable QR in an overlay", async () => {
    const page = await mountScan();
    try {
      await page.locator('button:has-text("Scan to connect (QR)")').click();
      await page.waitForTimeout(200);
      const r = await page.evaluate(() => {
        // QRCodeSVG renders <svg width={size} height={size}> at 180 in QRCard.
        // Selecting on "an svg with paths" instead matched the trigger's own
        // 14px icon and reported a 14px "QR".
        const qr = Array.from(document.querySelectorAll("svg")).find(
          (s) => Number(s.getAttribute("width") ?? 0) >= 100,
        );
        const panel = Array.from(document.querySelectorAll("p")).find((p) => p.textContent === "Scan to connect");
        const overlay = document.querySelector(".fixed.inset-0") as HTMLElement | null;
        return {
          hasQr: !!qr,
          qrBox: qr ? Math.round(qr.getBoundingClientRect().width) : 0,
          qrModules: qr ? (qr.getAttribute("viewBox") ?? "").split(" ")[2] : null,
          panelVisible: !!panel && panel.getBoundingClientRect().height > 0,
          overlayIsChildOfBody: overlay?.parentElement === document.body,
          zIndex: overlay ? getComputedStyle(overlay).zIndex : null,
        };
      });
      // A real module grid for a ~45-char URL, not a decorative glyph.
      expect(Number(r.qrModules)).toBeGreaterThanOrEqual(21);
      expect(r.hasQr, "no QR rendered in the popup").toBe(true);
      // A real module grid, not a stray icon.
      expect(r.qrBox).toBeGreaterThan(100);
      expect(r.panelVisible).toBe(true);
      // Portaled to <body>: an ancestor transform would otherwise cage a
      // position:fixed overlay inside the card panel, and CardPreviewDownload
      // puts scale() on the card a few levels up.
      expect(r.overlayIsChildOfBody, "the overlay is not portaled to body").toBe(true);
      expect(Number(r.zIndex)).toBeGreaterThanOrEqual(50);
    } finally { await page.close(); }
  }, 90_000);

  it("closes on the × and on a backdrop tap", async () => {
    const page = await mountScan();
    try {
      const open = page.locator('button:has-text("Scan to connect (QR)")');
      await open.click();
      await page.waitForTimeout(150);
      await page.locator('button[aria-label="Close"]').click();
      await page.waitForTimeout(150);
      expect(await page.locator(".fixed.inset-0").count(), "× did not close the popup").toBe(0);

      await open.click();
      await page.waitForTimeout(150);
      // Click the backdrop itself, well away from the QR panel.
      await page.mouse.click(10, 10);
      await page.waitForTimeout(150);
      expect(await page.locator(".fixed.inset-0").count(), "backdrop tap did not close the popup").toBe(0);
    } finally { await page.close(); }
  }, 90_000);
});

describe("two panels on one page resolve to their OWN card", () => {
  it("each provider reports its own registration", async () => {
    // The dashboard renders the panel twice with one copy display:none. If both
    // shared a provider, whichever registered last would win and the visible
    // modal could rasterize the hidden card — a blank PNG, silently.
    const page = await mount(MOBILE, { twoPanels: true });
    try {
      const probes = await page.evaluate(() => ({
        a: document.getElementById("probe-card-a")?.textContent,
        b: document.getElementById("probe-card-b")?.textContent,
      }));
      expect(probes.a).toBe("card-a.png");
      expect(probes.b).toBe("card-b.png");
    } finally { await page.close(); }
  }, 90_000);

  it("and both still open a working modal", async () => {
    const page = await mount(MOBILE, { twoPanels: true });
    try {
      const second = await openModal(page, 1);
      expect(second.downloadCard).toBe(true);
      expect(second.downloadQr).toBe(true);
    } finally { await page.close(); }
  }, 90_000);
});
