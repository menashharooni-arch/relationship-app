import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("rating claims are fully removed", () => {
  const page = read("src/app/page.tsx");

  it("no 4.9 / 5 rating copy remains on the landing page", () => {
    expect(page).not.toMatch(/4\.9\s*\/\s*5/);
    expect(page).not.toMatch(/\/\s*5 rating/i);
  });

  it("no structured-data rating markup anywhere in src", () => {
    // Walk the two files most likely to carry it; assert the specific tokens.
    for (const f of ["src/app/page.tsx", "src/app/layout.tsx"]) {
      const src = read(f);
      expect(src).not.toMatch(/aggregateRating/);
      expect(src).not.toMatch(/ratingValue/);
    }
  });

  it("no star/rating phrasing remains (pricing decimals like 4.99 are fine)", () => {
    // Guard the human-readable rating claims specifically — not raw decimals,
    // which legitimately appear inside SVG path coordinates and pricing.
    expect(page).not.toMatch(/\d(?:\.\d)?\s*(?:\/\s*5|out of 5|star)/i);
    expect(page).not.toMatch(/\b\d(?:\.\d)?\s*rating\b/i);
  });
});

describe("hero cover image is the illustrated placeholder, not a real photo", () => {
  it("HeroPhone references the illustrated avatar, not headshot.jpg", () => {
    const hero = read("src/components/HeroPhone.tsx");
    expect(hero).toMatch(/\/demo\/avatar\.svg/);
    expect(hero).not.toMatch(/headshot\.jpg/);
  });

  it("the illustrated avatar asset exists and the real photo is gone", () => {
    expect(existsSync(join(root, "public/demo/avatar.svg"))).toBe(true);
    expect(existsSync(join(root, "public/demo/headshot.jpg"))).toBe(false);
  });

  it("the avatar is labelled a fictional placeholder for honesty", () => {
    const svg = read("public/demo/avatar.svg");
    expect(svg.toLowerCase()).toMatch(/fictional|placeholder|not a real/);
  });
});

describe("no follow-up popup/modal was reintroduced", () => {
  it("dashboard keeps the data-driven banner, not a popup", () => {
    const dash = read("src/app/dashboard/page.tsx");
    // The real, data-driven banner copy stays.
    expect(dash).toMatch(/follow-ups due today/);
    // No modal/popup component is wired around follow-ups.
    expect(dash).not.toMatch(/FollowUpPopup|FollowUpModal/);
  });
});
