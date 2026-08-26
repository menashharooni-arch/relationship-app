import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "esbuild";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Browser } from "playwright";
import { appCss, launchBrowser } from "./harness";

// INTERACTION test for the "Select a card" picker (owner report 2026-08-26:
// tapping a card "did nothing" for the full server round trip). The contract:
// the tap responds INSTANTLY — chosen row shows the spinner, the other rows dim
// and lock — while the navigation runs behind it. next/navigation is stubbed
// with a push that never resolves, freezing the pending state so it can be
// asserted instead of raced.

let browser: Browser;
let bundle: string;
let tmp: string;

beforeAll(async () => {
  browser = await launchBrowser();
  const cache = resolve("node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  tmp = mkdtempSync(join(cache, "picker-"));

  writeFileSync(join(tmp, "nav-stub.tsx"), `
    export function useRouter() {
      return { push: (url: string) => { (window as any).__pushedTo = url; return new Promise(() => {}); } };
    }
  `);
  writeFileSync(join(tmp, "entry.tsx"), `
    import { createRoot } from "react-dom/client";
    import { createElement } from "react";
    import CardPickerList from "@/components/CardPickerList";
    const cards = [
      { id: "a", username: "menashharooni-swiftcard", title: "SwiftCard", slugDisplay: "MenashHarooni-SwiftCard", name: "Menash Harooni" },
      { id: "b", username: "aaronlavi-malvecapital", title: "Malve", slugDisplay: "AaronLavi-MalveCapital", name: "Aaron Lavi" },
    ];
    createRoot(document.getElementById("root")!).render(createElement(CardPickerList, { cards }));
  `);

  const out = await build({
    entryPoints: [join(tmp, "entry.tsx")],
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: {
      "@": resolve("src"),
      "next/navigation": join(tmp, "nav-stub.tsx"),
    },
  });
  bundle = out.outputFiles[0].text;
});

afterAll(async () => {
  await browser?.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("Select a card responds to the tap instantly", () => {
  it("spinner on the chosen row, other rows dim and lock, navigation fired", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(`<style>${await appCss()}</style><div id="root"></div>`);
    await page.addScriptTag({ content: bundle });
    await page.waitForSelector("button");

    const rows = page.locator("button");
    expect(await rows.count()).toBe(2);

    await rows.first().click();
    // Immediately — no waiting for any network: the pending UI must be there.
    const spinner = page.locator('[aria-label="Opening card"]');
    await spinner.waitFor({ state: "visible", timeout: 1500 });

    // The OTHER row dims and both lock while the transition is pending.
    expect(await rows.nth(1).getAttribute("class")).toContain("opacity-40");
    expect(await rows.nth(1).isDisabled()).toBe(true);

    // And the navigation actually went to the chosen card.
    const pushed = await page.evaluate(() => (window as unknown as { __pushedTo?: string }).__pushedTo);
    expect(pushed).toBe("/dashboard?card=menashharooni-swiftcard");
    await page.close();
  });
});
