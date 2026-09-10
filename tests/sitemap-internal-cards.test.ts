import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isInternalCardSlug } from "@/lib/seeded-views";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("our own test cards are not offered to Google", () => {
  it("recognises the App Review and IAP test slugs", () => {
    // Real ones observed live in sitemap.xml.
    for (const slug of ["apple-review-7c9e9913", "apple-review-bd38b805", "iaptest-033f30"]) {
      expect(isInternalCardSlug(slug), `${slug} is ours, not a customer's`).toBe(true);
    }
  });

  it("matches on prefix, because each submission mints a new suffix", () => {
    expect(isInternalCardSlug("apple-review-anything-at-all")).toBe(true);
    expect(isInternalCardSlug("APPLE-REVIEW-UPPERCASE")).toBe(true);
  });

  it("leaves the marketing demos alone", () => {
    // /demo-sales and /demo-realty are linked from the preview page and the
    // marketing components. They are content we chose to publish, and pulling
    // them from the sitemap would be a self-inflicted SEO loss.
    for (const slug of ["demo-sales", "demo-realty", "swiftcard", "aaronlavi-malvecapital"]) {
      expect(isInternalCardSlug(slug), `${slug} must stay indexable`).toBe(false);
    }
  });

  it("never treats a real customer slug as internal", () => {
    for (const slug of ["johnsmith-acme", "applecare-repairs", "iaptechnologies", "", null, undefined]) {
      expect(isInternalCardSlug(slug)).toBe(false);
    }
  });

  it("the sitemap actually applies the filter", () => {
    const sitemap = read("src/app/sitemap.ts");
    expect(sitemap).toContain("isInternalCardSlug");
    // Applied to the card list, not somewhere decorative.
    const liveFilter = sitemap.slice(sitemap.indexOf("const live ="), sitemap.indexOf("const ownerIds"));
    expect(liveFilter).toContain("isInternalCardSlug");
  });
});
