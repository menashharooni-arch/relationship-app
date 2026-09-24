import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "esbuild";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Browser, Page } from "playwright";
import { appCss, launchBrowser } from "./harness";

// ── Office Branding: the accent picker reaches the preview ──────────────────
//
// Bundles the REAL OfficeBranding page (same rig as office-branding-custom).

const ORIGIN = "https://sc.test";
let browser: Browser;
let bundle: string;
let css: string;
let tmp: string;

beforeAll(async () => {
  browser = await launchBrowser();
  css = await appCss();
  const cache = resolve("node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  tmp = mkdtempSync(join(cache, "accentrepro-"));
  writeFileSync(join(tmp, "nav-stub.tsx"), `
    export function useRouter() { return { push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} }; }
    export function usePathname() { return "/office/admin/branding"; }
    export function useSearchParams() { return new URLSearchParams(); }
  `);
  writeFileSync(join(tmp, "link-stub.tsx"), `
    import { createElement } from "react";
    export default function Link(props: any) {
      const { href, children, prefetch, scroll, ...rest } = props;
      return createElement("a", { href: typeof href === "string" ? href : "#", ...rest }, children);
    }
    export function useLinkStatus() { return { pending: false }; }
  `);
  writeFileSync(join(tmp, "entry.tsx"), `
    import { createRoot } from "react-dom/client";
    import { createElement } from "react";
    import OfficeBranding from "@/components/OfficeBranding";
    (window as any).mount = (office: any) => {
      createRoot(document.getElementById("root")!).render(
        createElement("div", { className: "sc-app p-4" }, createElement(OfficeBranding, { office })),
      );
    };
  `);
  const out = await build({
    entryPoints: [join(tmp, "entry.tsx")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    // The logo uploader's cropper imports its own stylesheet; the app's CSS is
    // injected separately, and the cropper is not what this test is about.
    loader: { ".css": "empty" },
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.NEXT_PUBLIC_SUPABASE_URL": '"https://example.supabase.co"',
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '"anon"',
      "process.env.NEXT_PUBLIC_APP_URL": '"https://sc.test"',
      "process.env.NEXT_PUBLIC_APP_STORE_URL": "undefined",
      "process.env.NEXT_PUBLIC_APP_STORE_ID": "undefined",
      "process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY": "undefined",
    },
    alias: {
      "next/navigation": join(tmp, "nav-stub.tsx"),
      "next/link": join(tmp, "link-stub.tsx"),
      "@": resolve("src"),
    },
  });
  bundle = out.outputFiles[0].text;
  if (!bundle || bundle.length < 1000) throw new Error("OfficeBranding bundle is empty — the esbuild step failed");
}, 180_000);

afterAll(async () => {
  await browser?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

const FACE = "https://example.supabase.co/storage/v1/object/public/cards/owner-face.png";

async function rig(office: Record<string, unknown>, width = 1280): Promise<{ page: Page; saves: Array<Record<string, unknown>> }> {
  const ctx = await browser.newContext({ viewport: { width, height: 1400 } });
  const page = await ctx.newPage();
  const saves: Array<Record<string, unknown>> = [];
  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === ORIGIN && url.pathname === "/") {
      return route.fulfill({
        status: 200, contentType: "text/html",
        body: `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
          <style>body{margin:0;background:#0b0f16}</style></head>
          <body><div id="root"></div><script>window.process={env:{}};</script><script>${bundle}</script></body></html>`,
      });
    }
    if (url.pathname === "/api/office/brand" && req.method() === "PATCH") {
      saves.push(JSON.parse(req.postData() || "{}"));
      return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    }
    // Everything else (logo suggestions, images): answered empty, never the internet.
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto(`${ORIGIN}/`);
  await page.evaluate((o) => (window as unknown as { mount: (x: unknown) => void }).mount(o), office);
  await page.locator("button[aria-pressed]:visible").first().waitFor();
  return { page, saves };
}



// ── Every "Accent / icons" swatch changes the preview ───────────────────────
//
// Owner, 2026-09-22: "I'm trying to edit the accent/icon colors and when I
// press on different colors, it's not changing anything on the preview." On
// Logo First with a finish on, the background is a gradient; the accent's
// contrast check could not read it and returned white for every pick. Clicks
// every swatch on every template, with and without a finish, and compares the
// colours actually painted in the preview.

const previewColors = (page: Page) => page.evaluate(() => {
  // The VISIBLE preview: the Links tab stays mounted (hidden) above the Card
  // tab and carries its own inert preview, which no accent pick touches.
  const root = [...document.querySelectorAll<HTMLElement>("[inert]")].find((el) => el.offsetParent !== null)!;
  const set = new Set<string>();
  root.querySelectorAll("*").forEach((el) => {
    const s = getComputedStyle(el);
    set.add(s.color); set.add(s.backgroundColor); set.add(s.fill); set.add(s.stroke); set.add(s.borderColor);
  });
  return [...set].sort().join("|");
});

const TEMPLATES = ["classic-pro", "modern-bold", "photo-first", "local-business", "luxury-minimal", "logo-first"];
const DESIGNS: Array<[string, Record<string, unknown>]> = [
  ["no finish", {}],
  ["dark + Sheen", { bgColor: "#1f2430", textColor: "#ffffff", finish: "sheen" }],
];

describe("Office Branding: every Accent / icons swatch changes the preview", () => {
  for (const t of TEMPLATES) {
    for (const [name, design] of DESIGNS) {
      it(`${t} · ${name}`, async () => {
        const { page } = await rig({ brand_company: "Northwind", brand_website: "northwind.com", brand_template: t, brand_phone: "(555) 111-2222", brand_design: design }, 390);
        const swatches = page.locator('[data-design-step="accent"] button[aria-label="Color preset"]');
        const n = await swatches.count();
        expect(n).toBeGreaterThan(2);
        const seen = new Set<string>([await previewColors(page)]);
        // Swatch 0 is the template's own default, so it may match the start.
        for (let i = 1; i < n; i++) {
          await swatches.nth(i).click();
          await page.waitForTimeout(80);
          seen.add(await previewColors(page));
        }
        // Each non-default swatch paints something new.
        expect(seen.size, `${t} · ${name}: accent picks that changed nothing`).toBe(n);
        await page.context().close();
      }, 60_000);
    }
  }
});
