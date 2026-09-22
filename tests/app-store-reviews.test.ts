import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const LIB = "src/lib/app-store-reviews.ts";
const SECTION = "src/components/site/AppStoreReviews.tsx";

// The App Store review section on /testimonials.
//
// Two rules the owner set on 2026-09-22 — show only reviews of 4.5 stars and
// up, and give people a way to leave one — meet a third that predates them:
// the page must never state a rating it made up (FTC 16 CFR Part 465, and the
// standing note at the top of src/app/testimonials/page.tsx). Those pull in
// opposite directions, which is the whole reason for this file: a filtered set
// of five-star cards is honest, and averaging THAT set to produce the headline
// number is not. These pin both halves.

async function load() {
  vi.resetModules();
  return import("@/lib/app-store-reviews");
}

/** One Apple RSS entry, in the shape the feed actually returns. */
function entry(rating: number, over: Record<string, unknown> = {}) {
  return {
    id: { label: `id-${rating}-${Math.random()}` },
    author: { name: { label: "A Reviewer" } },
    "im:rating": { label: String(rating) },
    "im:version": { label: "1.0.2" },
    title: { label: "A title" },
    content: { label: "Body text that makes it a written review." },
    ...over,
  };
}

function feed(entries: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ feed: { entry: entries } }),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function withApp() {
  vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "https://apps.apple.com/app/id6798875872");
}

describe("the 4.5-star rule", () => {
  it("is 4.5, and lives in the lib so no surface can use a different one", async () => {
    const { MIN_DISPLAY_RATING } = await load();
    expect(MIN_DISPLAY_RATING).toBe(4.5);
    // The page must not re-implement the threshold with its own number.
    const section = read(SECTION);
    expect(section).toContain("MIN_DISPLAY_RATING");
    expect(section).not.toMatch(/rating\s*[><]=?\s*[0-9]/);
  });

  it("keeps 5-star reviews and drops everything below", async () => {
    withApp();
    vi.stubGlobal("fetch", vi.fn(async () => feed([
      entry(5, { title: { label: "Great" } }),
      entry(4, { title: { label: "Good but" } }),
      entry(1, { title: { label: "Hated it" } }),
      entry(3),
      entry(5, { title: { label: "Also great" } }),
    ])));
    const { fetchAppStoreReviews } = await load();
    const out = await fetchAppStoreReviews();
    expect(out.map((r) => r.title)).toEqual(["Great", "Also great"]);
    expect(out.every((r) => r.rating >= 4.5)).toBe(true);
  });

  it("shows nothing at all when every review is below the line", async () => {
    withApp();
    vi.stubGlobal("fetch", vi.fn(async () => feed([entry(4), entry(3), entry(1)])));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchAppStoreReviews } = await load();
    expect(await fetchAppStoreReviews()).toEqual([]);
    // …and says why, rather than leaving an empty section with no explanation.
    expect(warn.mock.calls.flat().join(" ")).toMatch(/below the 4.5-star threshold/);
  });

  it("honours the limit after filtering, not before", async () => {
    withApp();
    vi.stubGlobal("fetch", vi.fn(async () => feed([
      entry(1), entry(1), entry(5), entry(1), entry(5), entry(5),
    ])));
    const { fetchAppStoreReviews } = await load();
    expect(await fetchAppStoreReviews(2)).toHaveLength(2);
  });
});

describe("the headline score is Apple's, never ours", () => {
  it("has no function that averages the reviews we chose to show", async () => {
    const mod = await load();
    // averageRating() used to exist and would now be a lie: it averages a set
    // filtered to 4.5+, so it can only ever return ~5.0.
    expect("averageRating" in mod).toBe(false);
    expect(read(SECTION)).not.toContain("averageRating");
  });

  it("reads Apple's lifetime average and rating count from the lookup endpoint", async () => {
    withApp();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ results: [{ averageUserRating: 4.86, userRatingCount: 6 }] }),
    }) as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAppStoreRating } = await load();
    expect(await fetchAppStoreRating()).toEqual({ average: 4.9, count: 6 });
    expect(String(fetchMock.mock.calls[0][0])).toContain("itunes.apple.com/lookup?id=6798875872");
  });

  it("shows no score rather than a guess when Apple gives none", async () => {
    withApp();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200, statusText: "OK",
      json: async () => ({ results: [] }),
    }) as unknown as Response));
    const { fetchAppStoreRating } = await load();
    expect(await fetchAppStoreRating()).toBeNull();
  });

  it("discloses on the page that the reviews shown are a selection", () => {
    const section = read(SECTION);
    expect(section).toMatch(/stars or\s*\n?\s*higher/);
    expect(section).toContain("The score above is Apple's own, across every rating");
  });
});

describe("leaving a review", () => {
  it("offers a Write a review button pointing at Apple's review form", () => {
    const section = read(SECTION);
    expect(section).toContain("APP_STORE_WRITE_REVIEW_URL");
    expect(section).toContain("Write a review");
    // Built from the id in lib/app-store, never hardcoded here.
    expect(section).not.toContain("action=write-review");
    expect(read("src/lib/app-store.ts")).toContain("?action=write-review");
  });

  it("hides the panel when there is no App Store listing to send anyone to", () => {
    // Same self-activating contract as every other APP_STORE_URL consumer.
    expect(read(SECTION)).toContain("{APP_STORE_WRITE_REVIEW_URL && (");
  });
});

describe("failing safe, and saying so", () => {
  it("never invents a review when Apple is unreachable", async () => {
    withApp();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const { fetchAppStoreReviews } = await load();
    expect(await fetchAppStoreReviews()).toEqual([]);
    expect(warn.mock.calls.flat().join(" ")).toMatch(/\[app-store-reviews\].*ECONNREFUSED/);
  });

  it("reports the status code when Apple refuses the feed", async () => {
    withApp();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status: 403, statusText: "Forbidden", json: async () => ({}),
    }) as unknown as Response));
    const { fetchAppStoreReviews } = await load();
    expect(await fetchAppStoreReviews()).toEqual([]);
    expect(warn.mock.calls.flat().join(" ")).toMatch(/403/);
  });

  it("keeps a lone review, which Apple returns as an object rather than an array", async () => {
    withApp();
    vi.stubGlobal("fetch", vi.fn(async () => feed(entry(5, { title: { label: "The first one" } }))));
    const { fetchAppStoreReviews } = await load();
    expect((await fetchAppStoreReviews()).map((r) => r.title)).toEqual(["The first one"]);
  });

  it("stays dormant with no App Store id configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "");
    vi.stubEnv("APP_STORE_ID", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAppStoreReviews, fetchAppStoreRating } = await load();
    expect(await fetchAppStoreReviews()).toEqual([]);
    expect(await fetchAppStoreRating()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders nothing when there is nothing to show", () => {
    expect(read(SECTION)).toContain("if (!reviews.length) return null;");
  });

  it("does not let one failed fetch take the other down", () => {
    // reviews and rating are independent: the section still renders reviews
    // with no score, and never waits on a serial chain.
    const section = read(SECTION);
    expect(section).toContain("Promise.all");
    expect(section).toContain("{rating && (");
  });
});

describe("the page still carries the section", () => {
  it("is rendered on /testimonials", () => {
    const page = read("src/app/testimonials/page.tsx");
    expect(page).toContain("<AppStoreReviews />");
    expect(page).toContain('from "@/components/site/AppStoreReviews"');
  });

  it("keeps the standing rule against invented testimonials", () => {
    expect(read("src/app/testimonials/page.tsx")).toContain("16 CFR Part 465");
  });
});
