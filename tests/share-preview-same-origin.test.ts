import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { warmSharePreview } from "@/lib/share-preview";

// ── A warm that cannot work must not be attempted ────────────────────────────
//
// FOUND 2026-09-08 by the browser sweep: every load of `/`, `/preview` and
// `/products/digital-cards` on a dev box or a preview deploy fetched
// https://swiftcard.me/alexmorgan — a real production card page — and logged a
// CORS error for it. The marketing demos hand ShareButton that URL hardcoded,
// and ShareButton warms its link on mount.
//
// The fetch could never have done its job: CORS blocks reading a cross-origin
// body, so ogImageFromHtml sees nothing and the og:image — the only thing
// worth warming — is never fetched. So the request was pure cost, and it
// pointed at production from environments that have no business touching it.
//
// On production the same URLs are same-origin, so the real warm path is
// untouched. That is the pair this file pins: cross-origin does nothing,
// same-origin still does everything.
//
// tests/share-preview-cache.test.ts scans the SOURCE for the call sites. This
// one runs the function, because "makes no request" is a runtime property.

const ORIGIN = "https://swiftcard.me";

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;

beforeEach(() => {
  fetchMock = vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes("opengraph-image")) {
      return { ok: true, headers: new Map(), text: async () => "" } as unknown as Response;
    }
    return {
      ok: true,
      text: async () => '<meta property="og:image" content="https://swiftcard.me/dana/opengraph-image?v=abc"/>',
    } as unknown as Response;
  });

  vi.stubGlobal("window", { location: { href: `${ORIGIN}/dashboard`, origin: ORIGIN, pathname: "/dashboard" } });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("document", { querySelector: () => null });
  vi.stubGlobal("AbortController", class { signal = {}; abort() {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** warmSharePreview is fire-and-forget; let its async body run. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("warmSharePreview only warms links it can actually warm", () => {
  it("makes no request at all for a cross-origin card link", async () => {
    warmSharePreview("https://swiftcard.me/alexmorgan");
    await settle();
    // window.location.origin is swiftcard.me here, so flip the target instead.
    fetchMock.mockClear();
    warmSharePreview("https://someone-elses-domain.example/alexmorgan");
    await settle();
    expect(
      fetchMock,
      "A cross-origin warm can never read the og:image (CORS blocks the body), " +
        "so the request is guaranteed useless — and it pointed dev and preview " +
        "environments straight at production.",
    ).not.toHaveBeenCalled();
  });

  it("still warms a same-origin card link, page then image", async () => {
    warmSharePreview(`${ORIGIN}/dana`);
    await settle();
    await settle();
    const called = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(called[0]).toBe(`${ORIGIN}/dana`);
    expect(called.some((u) => u.includes("opengraph-image"))).toBe(true);
  });

  it("treats a relative link as same-origin and warms it", async () => {
    warmSharePreview("/dana");
    await settle();
    await settle();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/dana");
  });

  it("does not throw on a malformed link", async () => {
    expect(() => warmSharePreview("not a url at all")).not.toThrow();
    await settle();
  });

  it("drops the fragment before deciding, so #anchor links still warm", async () => {
    warmSharePreview(`${ORIGIN}/dana#links`);
    await settle();
    await settle();
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${ORIGIN}/dana`);
  });
});
