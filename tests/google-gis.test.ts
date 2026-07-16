import { describe, it, expect, afterEach } from "vitest";
import { loadGoogleIdentity } from "@/lib/google-gis";

// The loader must reject cleanly (never throw a synchronous ReferenceError)
// when there is no browser window — so it's always safe to import/call from
// code that might run during SSR. Control the `window` global explicitly so
// this doesn't depend on whether another test in the suite left one defined.
describe("loadGoogleIdentity — SSR safety", () => {
  const hadWindow = "window" in globalThis;
  const saved = (globalThis as { window?: unknown }).window;

  afterEach(() => {
    if (hadWindow) (globalThis as { window?: unknown }).window = saved;
    else delete (globalThis as { window?: unknown }).window;
  });

  it("rejects when there is no window (SSR context)", async () => {
    delete (globalThis as { window?: unknown }).window;
    await expect(loadGoogleIdentity()).rejects.toThrow(/browser/i);
  });
});
