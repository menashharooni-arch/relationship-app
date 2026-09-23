import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Owner, 2026-09-16: "if the admin puts an additional link, the subuser should
// not be able to redesign that or move that around … but the subuser can also
// add additional links themselves and design that additional link".
// Before: with "Keep every Swift Links page matching" ON the whole panel was
// replaced, so members could not style THEIR OWN links; with it OFF the
// per-link controls offered company rows too, and the server silently undid it.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const EDITOR = "src/app/cards/[id]/edit/CardEditForm.tsx";
const WIZARD = "src/app/cards/new/NewCardWizard.tsx";

describe("company links are shown fixed, never restyled", () => {
  it("LinkButtonsControls renders a locked row with no controls", () => {
    const src = read("src/components/LinkButtonsControls.tsx");
    expect(src).toMatch(/isLocked\?: \(l: CardLink\) => boolean;/);
    const locked = src.slice(src.indexOf("if (isLocked?.(l)) {"), src.indexOf("if (isLocked?.(l)) {") + 900);
    expect(locked).toContain("Set by your organization");
    expect(locked).not.toMatch(/onClick=/);
  });

  it("Social design passes the company-row test through", () => {
    expect(read("src/components/SwiftLinkDesign.tsx")).toMatch(/isLocked=\{isLinkLocked\}/);
    for (const f of [EDITOR, WIZARD]) expect(read(f), f).toMatch(/isLinkLocked=\{isOfficeRow\}/);
  });
});

describe("members style their own links even when the page look is locked", () => {
  for (const f of [EDITOR, WIZARD]) {
    it(f, () => {
      const src = read(f);
      const start = src.indexOf("{linkDesignLocked ? (");
      const end = src.indexOf("<SwiftLinkStyleControls", start);
      const lockedBranch = src.slice(start, end);
      expect(lockedBranch).toContain("Your link buttons");
      expect(lockedBranch).toMatch(/<LinkButtonsControls links=\{links\} onChange=\{setLinks\}[^>]*isLocked=\{isOfficeRow\}/);
    });
  }
});

describe("every path that writes a member card applies the whole brand", () => {
  it("a draft claimed after joining gets design, links and Instagram, and loses the company half it typed", () => {
    const src = read("src/app/api/drafts/claim/route.ts");
    expect(src).toMatch(/replaceInto\(overlayOfficeDesign\(/);
    expect(src).toMatch(/replaceInto\(overlayOfficeLinks\(/);
    expect(src).toMatch(/overlayOfficeInstagram\(/);
    expect(src).toMatch(/if \(subCtx\) \{\s*insert\.company = "";\s*insert\.website = "";\s*insert\.logo_url = null;/);
  });

  it("an admin editing a member's card keeps the company links", () => {
    // The whole brand re-assert (contact, look, pinned links) is guarded on
    // "not the owner's own card" — a member's card gets all three.
    const r = read("src/app/api/office/cards/[id]/route.ts");
    const block = r.slice(r.indexOf("if (beforeCard?.user_id && beforeCard.user_id !== ctx.ownerId) {"));
    expect(block.length).toBeGreaterThan(0);
    expect(block.slice(0, 900)).toMatch(/merged = overlayOfficeLinks\(merged, brand\)/);
    expect(block.slice(0, 900)).toMatch(/merged = overlayOfficeDesign\(merged, brand\)/);
  });
});
