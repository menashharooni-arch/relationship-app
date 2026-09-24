import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// A card's OLD address (customization._prevSlugs) keeps redirecting to it, so
// printed QR codes, NFC tags and shared links survive a name change. Two holes
// let someone else end up behind that address:
//   • create (and the guest-draft claim) accepted "_"-prefixed keys, so a
//     crafted request could plant _prevSlugs: ["<someone's old address>"];
//   • slugTaken / manual rename only looked at LIVE addresses, so a new card
//     could simply be given another owner's old one.
const read = (p: string) => readFileSync(p, "utf8");

describe("server bookkeeping keys never come from the client", () => {
  it("card create drops every _-prefixed key before saving", () => {
    const s = read("src/app/api/cards/route.ts");
    expect(s).toMatch(/for \(const k of Object\.keys\(incomingCust\)\) if \(k\.startsWith\("_"\)\) delete incomingCust\[k\];/);
    expect(s).toContain("sanitizeCustomizationForPlan(incomingCust,");
  });

  it("the guest-draft claim drops them too", () => {
    const s = read("src/lib/draft-claim.ts");
    expect(s).toMatch(/for \(const k of Object\.keys\(rawCustomization\)\) if \(k\.startsWith\("_"\)\) delete rawCustomization\[k\];/);
  });

  it("card edit still does (unchanged)", () => {
    expect(read("src/app/api/cards/[id]/route.ts")).toMatch(/if \(k\.startsWith\("_"\)\) delete incoming\[k\]/);
  });
});

describe("an old address is not free for someone else", () => {
  it("slugTaken counts another card's old address as taken", () => {
    const s = read("src/lib/username.ts");
    expect(s).toContain("slugHeldAsAlias(admin, slug)");
    expect(s).toMatch(/return !!card \|\| !!profile \|\| heldAsAlias;/);
  });

  it("a hand-picked URL can't take another account's old address, but can take back your own", () => {
    const s = read("src/app/api/cards/[id]/rename/route.ts");
    expect(s).toContain("slugHeldAsAlias(admin, slug, user.id)");
    expect(s.indexOf("slugHeldAsAlias(")).toBeLessThan(s.indexOf('rpc("rename_card_slug"'));
  });

  it("the alias check fails closed, and the redirect resolves the oldest card deterministically", () => {
    const s = read("src/lib/slug-alias.ts");
    expect(s).toMatch(/if \(error\) return true;/);
    expect(s).toMatch(/\.order\("created_at", \{ ascending: true \}\)/);
  });
});
