import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// "AM I THE NATIVE SHELL?" — ONE ANSWER, NO SDK.
//
// lib/platform.ts is imported by 55 files, so whatever it imports is on every
// page of the WEBSITE too. It used to import @capacitor/core purely to call
// Capacitor.isNativePlatform(), which put 55 kB of the native runtime into the
// JS budget of every marketing page, every card page and every login — to
// compute a boolean that is always false there (perf audit 2026-09-14).
//
// It now reads the same two globals @capacitor/core reads, which are also the
// two the root layout's sc-boot script has always tested before first paint.
// This pins BOTH halves: that the detection is still correct in every shape the
// shell can present, and that the dependency has not crept back in.
// ─────────────────────────────────────────────────────────────────────────────

import { detectNativeApp } from "@/lib/platform";

type W = Record<string, unknown>;
const w = globalThis as unknown as W;

// The suite runs in the `node` environment, so there is no `window` at all and
// detectNativeApp's SSR guard would short-circuit every case below. Point
// `window` at the global object: reads of window.webkit / window.Capacitor then
// see exactly what each test plants, which is the thing under test.
beforeEach(() => { w.window = w; });

afterEach(() => {
  delete w.webkit;
  delete w.Capacitor;
  delete w.window;
});

describe("detectNativeApp", () => {
  it("is false on a plain browser — the website must never think it is the app", () => {
    expect(detectNativeApp()).toBe(false);
  });

  it("is false during a server render, where there is no window at all", () => {
    delete w.window;
    expect(detectNativeApp()).toBe(false);
  });

  it("is true on the WKWebView message handler, which lands before any page script", () => {
    w.webkit = { messageHandlers: { bridge: {} } };
    expect(detectNativeApp()).toBe(true);
  });

  it("is true from Capacitor's own runtime, whichever shape it exposes", () => {
    w.Capacitor = { isNativePlatform: () => true };
    expect(detectNativeApp()).toBe(true);

    delete w.Capacitor;
    w.Capacitor = { isNative: true };
    expect(detectNativeApp()).toBe(true);
  });

  it("is false when Capacitor is present but says web — a browser with the SDK loaded", () => {
    w.Capacitor = { isNativePlatform: () => false };
    expect(detectNativeApp()).toBe(false);
  });

  it("does not win on webkit alone — Safari has window.webkit and is not the app", () => {
    w.webkit = { messageHandlers: {} };
    expect(detectNativeApp()).toBe(false);
  });

  it("never throws, whatever nonsense is on the global", () => {
    w.Capacitor = { isNativePlatform: () => { throw new Error("boom"); } };
    expect(detectNativeApp()).toBe(false);
  });
});

describe("the 55 kB that must not come back", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("lib/platform.ts imports no Capacitor package", () => {
    expect(read("src/lib/platform.ts")).not.toMatch(/from "@capacitor\//);
  });

  it("nothing statically imports a Capacitor package — the shell loads them on demand", () => {
    // NativeAppBridge and friends use `await import("@capacitor/...")` inside
    // effects, so the plugin JS only ever reaches the device that needs it.
    const files = [
      "src/lib/platform.ts",
      "src/components/NativeAppBridge.tsx",
      "src/app/layout.tsx",
    ];
    for (const f of files) {
      const code = read(f);
      const statics = [...code.matchAll(/^import[^\n]*from "(@capacitor\/[^"]+)"/gm)];
      expect(statics.map((m) => m[1]), `${f} statically imports Capacitor`).toEqual([]);
    }
  });

  it("the boot script and detectNativeApp test the same two signals", () => {
    // They must agree: sc-boot decides before paint whether the app chrome is
    // used at all, and detectNativeApp decides it again in React. A drift here
    // is a frame of the wrong UI, which is exactly the "wrapped web page" tell.
    const layout = read("src/app/layout.tsx");
    const platform = read("src/lib/platform.ts");
    for (const signal of ["messageHandlers", "isNativePlatform", "isNative"]) {
      expect(layout, `sc-boot lost the ${signal} check`).toMatch(signal);
      expect(platform, `detectNativeApp lost the ${signal} check`).toMatch(signal);
    }
  });
});
