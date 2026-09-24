import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { previewVersion } from "../src/lib/share-preview";
import { cardImageData, isLinksPageOnlyKey } from "../src/lib/signature-content";
import { signatureContentChanged } from "../src/lib/card-changed";
import type { CardData } from "../src/components/card-templates/types";

describe("Edit card: the logo waits for Save", () => {
  it("the logo uploader is deferred, like the headshot and the builder", () => {
    const s = readFileSync("src/app/cards/[id]/edit/CardEditForm.tsx", "utf8");
    expect(s).toMatch(/<ImageUpload field="logo"[^>]* defer onUploaded=/);
  });
});

describe("link previews change when the card's look changes", () => {
  const base = { name: "Dana", template: "classic-pro" };
  it("a design-only edit gives a new preview URL", () => {
    expect(previewVersion({ ...base, style: { accentColor: "#123456" } }))
      .not.toBe(previewVersion({ ...base, style: { accentColor: "#654321" } }));
    expect(previewVersion({ ...base, custom: { background: "#000" } }))
      .not.toBe(previewVersion({ ...base, custom: { background: "#fff" } }));
  });
  it("a card with no design overrides keeps the version it already had", () => {
    expect(previewVersion({ ...base, style: { accentColor: undefined } })).toBe(previewVersion(base));
  });
  it("the share image's accent is the plan-filtered one", () => {
    expect(readFileSync("src/lib/resolve-card.ts", "utf8")).toContain("accentColor: str(style.accentColor),");
  });
});

describe("Swift Links-only edits don't ask for a signature re-copy", () => {
  it("every link* style, the bio and the View SwiftCard toggle are page-only; linkedin is not", () => {
    for (const k of ["links", "bio", "linkHeroStyle", "linkButtonShape", "linkAccentColor", "hideCardLink"]) {
      expect(isLinksPageOnlyKey(k), k).toBe(true);
    }
    for (const k of ["linkedin", "accentColor", "fontFamily", "phones"]) expect(isLinksPageOnlyKey(k), k).toBe(false);
  });
  it("a Swift Links hero change is not a signature change, a card colour change is", () => {
    const before = { name: "Dana", customization: { accentColor: "#111", linkHeroStyle: "cover" } };
    expect(signatureContentChanged(before, { customization: { accentColor: "#111", linkHeroStyle: "banner" } })).toBe(false);
    expect(signatureContentChanged(before, { customization: { accentColor: "#222", linkHeroStyle: "cover" } })).toBe(true);
  });
  it("the signature capture ignores the same keys", () => {
    const d = { name: "Dana", customization: { accentColor: "#111", linkHeroStyle: "cover", hideCardLink: true } } as unknown as CardData;
    const c = cardImageData(d).customization as Record<string, unknown>;
    expect(c.accentColor).toBe("#111");
    expect(c.linkHeroStyle).toBeUndefined();
    expect(c.hideCardLink).toBeUndefined();
  });
});
