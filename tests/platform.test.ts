import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectNativeApp, isNativeApp } from "@/lib/platform";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("platform detection is SSR-safe and web-default-false", () => {
  it("(a) importing platform.ts in a Node/test env (no window) does not throw", () => {
    // The import at the top of this file already exercised module evaluation
    // without throwing. Re-assert the runtime values here.
    expect(typeof detectNativeApp).toBe("function");
    expect(typeof isNativeApp).toBe("boolean");
  });

  it("(a) isNativeApp resolves false with no window present", () => {
    // vitest runs in the Node ("node") environment — there is no window global,
    // mirroring Next.js server-side rendering.
    expect(typeof window).toBe("undefined");
    expect(isNativeApp).toBe(false);
    expect(detectNativeApp()).toBe(false);
  });

  it("detectNativeApp returns false even if a bare window exists but Capacitor is not native", () => {
    // Simulate a plain browser context (window present, no native Capacitor).
    const g = globalThis as unknown as { window?: unknown };
    const had = "window" in g;
    (g as { window?: unknown }).window = {} as unknown;
    try {
      expect(detectNativeApp()).toBe(false);
    } finally {
      if (!had) delete (g as { window?: unknown }).window;
    }
  });
});

describe("(b) no hydration-mismatch-prone pattern is used", () => {
  const src = read("src/lib/platform.ts");

  it("the render-time hook seeds its state to false and updates in a mount effect", () => {
    // The hook must start false so server HTML and the first client paint agree,
    // then flip in useEffect. Guard the exact shape so a refactor can't quietly
    // introduce a synchronous-in-render read.
    expect(src).toMatch(/useState\(false\)/);
    expect(src).toMatch(/useEffect\(/);
    expect(src).toMatch(/setNative\(detectNativeApp\(\)\)/);
  });

  it("detectNativeApp guards on typeof window before touching Capacitor", () => {
    expect(src).toMatch(/typeof window === "undefined"/);
  });
});
