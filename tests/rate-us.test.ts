import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { shouldShowRateUsBanner, RATE_US_HIDE_DAYS, RATE_US_VIEWS_NEEDED } from "@/lib/rate-us";

// ── "Rate us on the App Store" on the web ────────────────────────────────────
//
// Three surfaces (dashboard banner, Settings, footer) plus swiftcard.me/review.
// Apple's rules for a user-facing rating link: no star widget of ours, no
// "do you like us?" filter before the link, no reward for a review. The banner
// only chooses its moment. See src/lib/rate-us.ts.

const DAY = 86_400_000;
const code = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("dashboard banner rules", () => {
  const now = Date.parse("2026-09-22T12:00:00Z");

  it("waits for a good moment: a real lead, or enough views", () => {
    expect(shouldShowRateUsBanner({ leadCount: 0, viewCount: 0, dismissedAt: null }, now)).toBe(false);
    expect(shouldShowRateUsBanner({ leadCount: 0, viewCount: RATE_US_VIEWS_NEEDED - 1, dismissedAt: null }, now)).toBe(false);
    expect(shouldShowRateUsBanner({ leadCount: 1, viewCount: 0, dismissedAt: null }, now)).toBe(true);
    expect(shouldShowRateUsBanner({ leadCount: 0, viewCount: RATE_US_VIEWS_NEEDED, dismissedAt: null }, now)).toBe(true);
  });

  it("stays hidden for 60 days after a dismissal or a click, then may return", () => {
    const recent = new Date(now - 10 * DAY).toISOString();
    const old = new Date(now - (RATE_US_HIDE_DAYS + 1) * DAY).toISOString();
    expect(RATE_US_HIDE_DAYS).toBe(60);
    expect(shouldShowRateUsBanner({ leadCount: 3, viewCount: 50, dismissedAt: recent }, now)).toBe(false);
    expect(shouldShowRateUsBanner({ leadCount: 3, viewCount: 50, dismissedAt: old }, now)).toBe(true);
  });

  it("a garbage timestamp never hides the banner forever", () => {
    expect(shouldShowRateUsBanner({ leadCount: 1, viewCount: 0, dismissedAt: "not a date" }, now)).toBe(true);
  });
});

describe("the link", () => {
  beforeEach(() => { vi.resetModules(); vi.unstubAllEnvs(); });

  it("goes straight to the write-review form, in a new tab, with the desktop hint", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_ID", "1234567890");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement: h } = await import("react");
    const link = await import("@/components/RateUsLink");
    const out = renderToStaticMarkup(h(link.default, { placement: "footer" }));
    expect(out).toContain('href="https://apps.apple.com/app/id1234567890?action=write-review"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('title="Best on iPhone"');
    expect(out).toContain("Rate us on the App Store");
  });

  it("renders nothing until the App Store id is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_ID", "");
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement: h } = await import("react");
    const link = await import("@/components/RateUsLink");
    expect(renderToStaticMarkup(h(link.default, { placement: "footer" }))).toBe("");
  });

  it("the id is never hardcoded", () => {
    for (const f of ["src/lib/rate-us.ts", "src/components/RateUsLink.tsx", "src/components/RateUsBanner.tsx", "src/app/review/route.ts"]) {
      expect(code(f)).not.toMatch(/6798875872/);
    }
  });

  it("no star widget and no feeling-gate on any web surface (App Review 1.1.7 / 5.6.1)", () => {
    for (const f of ["src/components/RateUsLink.tsx", "src/components/RateUsBanner.tsx"]) {
      const src = code(f);
      expect(src).not.toMatch(/★|⭐|star/i);
      expect(src).not.toMatch(/enjoy(ing)? swiftcard\?|how do you feel|do you like/i);
    }
  });
});
