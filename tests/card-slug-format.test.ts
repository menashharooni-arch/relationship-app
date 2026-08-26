import { describe, it, expect } from "vitest";
import { cardSlug, prettyCardSlug, normalizeSlug } from "@/lib/slug";

// Owner order 2026-08-26: the card link is FirstLast-Company — ONE hyphen,
// between the name and the company, never inside either. "Aaron Lavi" at
// "Malve Capital" shares swiftcard.me/AaronLavi-MalveCapital and the stored
// slug is its lowercase. Public routes lowercase the path, so the pretty
// casing always resolves.
describe("the card slug format is FirstLast-Company", () => {
  it("fuses the name and the company, one hyphen between them", () => {
    expect(prettyCardSlug("Aaron Lavi", "Malve Capital")).toBe("AaronLavi-MalveCapital");
    expect(cardSlug("Aaron Lavi", "Malve Capital")).toBe("aaronlavi-malvecapital");
  });
  it("no company → just the fused name", () => {
    expect(prettyCardSlug("Aaron Lavi", "")).toBe("AaronLavi");
    expect(cardSlug("Aaron Lavi", null)).toBe("aaronlavi");
  });
  it("punctuation and extra spaces never leak into the slug", () => {
    expect(prettyCardSlug("  Mary-Jane  O'Neil ", "Smith & Co., LLC")).toBe("MaryJaneONeil-SmithCoLLC");
    expect(cardSlug("Mary-Jane O'Neil", "Smith & Co., LLC")).toBe("maryjaneoneil-smithcollc");
  });
  it("the canonical form is exactly the pretty form through the normalizer", () => {
    for (const [n, c] of [["Aaron Lavi", "Malve Capital"], ["José Núñez", "Café 24"], ["A B C", "D E"]] as const) {
      expect(cardSlug(n, c)).toBe(normalizeSlug(prettyCardSlug(n, c)));
    }
  });
});
