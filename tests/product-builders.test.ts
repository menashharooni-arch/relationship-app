import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasSketchContent, PREFILL_STYLE_KEYS, type CardPrefill } from "@/lib/prefill";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const BUILDERS = {
  card: "src/components/site/CardMiniBuilder.tsx",
  swiftlink: "src/components/site/SwiftLinkMiniBuilder.tsx",
  signature: "src/components/site/SignatureMiniBuilder.tsx",
};

// The homepage builders are full pre-account editors, not sketch pads: they run
// the SAME controls as the signed-in editor, and everything a visitor does has
// to survive the hand-off into their new account.

describe("the whole design survives the hand-off, not just the accent", () => {
  it("carries every style key the editor can set", () => {
    // Previously only accentColor rode along, so a visitor's background, text
    // colour and font were silently dropped on the way into the wizard.
    for (const k of ["accentColor", "bgColor", "textColor", "infoColor", "fontFamily"]) {
      expect(PREFILL_STYLE_KEYS).toContain(k);
    }
  });

  it("a sketch that is ONLY a restyle still counts as worth carrying", () => {
    // hasSketchContent gates the hand-off; a pure design change has no text.
    expect(hasSketchContent({ bgColor: "#052e2b" } as CardPrefill)).toBe(true);
    expect(hasSketchContent({ fontFamily: "Georgia, serif" } as CardPrefill)).toBe(true);
    expect(hasSketchContent({} as CardPrefill)).toBe(false);
    expect(hasSketchContent({ template: "classic-pro" } as CardPrefill)).toBe(false);
  });

  it("the wizard applies every carried style key, not a hand-picked subset", () => {
    const src = read("src/app/cards/new/NewCardWizard.tsx");
    expect(src).toContain("PREFILL_STYLE_KEYS");
  });
});

describe("builders reuse the real editor components", () => {
  for (const [product, file] of Object.entries(BUILDERS)) {
    it(`${product} uses the shared sketch + the editor's own style controls`, () => {
      const src = read(file);
      expect(src, file).toContain("useProductSketch");
      expect(src, file).toContain("TemplateStyleControls");
      expect(src, file).toContain("InertPreview");
    });
  }

  it("photo + logo suggestions are offered before an account exists", () => {
    // Card and signature both carry a company logo; all three take a headshot.
    expect(read(BUILDERS.card)).toContain("LogoSuggest");
    expect(read(BUILDERS.signature)).toContain("LogoSuggest");
    for (const f of Object.values(BUILDERS)) {
      expect(read(f), f).toContain("ProfilePhotoSuggest");
      // guest mode — the suggestion is keyed on the typed email, not a session.
      expect(read(f), f).toMatch(/<ProfilePhotoSuggest[^>]*guest/);
    }
  });
});

describe("each product asks only for what it renders", () => {
  // Match rendered FIELDS (label="…"), not prose — a comment explaining why a
  // field is absent must not read as the field being present.
  const asksFor = (file: string, label: string) =>
    new RegExp(`label="${label}"`, "i").test(read(file));

  it("the SwiftLink builder never asks for card-only details", () => {
    for (const f of ["Street address", "ZIP", "City", "State", "Fax"]) {
      expect(asksFor(BUILDERS.swiftlink, f), f).toBe(false);
    }
  });

  it("the signature builder never asks for a postal address", () => {
    for (const f of ["Street address", "ZIP", "City", "State"]) {
      expect(asksFor(BUILDERS.signature, f), f).toBe(false);
    }
  });

  it("only the card builder collects a full postal address", () => {
    for (const f of ["Street address", "ZIP", "City", "State"]) {
      expect(asksFor(BUILDERS.card, f), f).toBe(true);
    }
  });
});

describe("guest suggestion endpoints are open but budgeted", () => {
  it("logo lookup allows signed-out visitors, with a tighter per-IP cap", () => {
    const src = read("src/app/api/logo-suggest/route.ts");
    expect(src).toContain("GUEST_LIMIT");
    expect(src).toContain("clientIp");
    // No blanket 401 anymore — that was what blocked pre-account suggestions.
    expect(src).not.toMatch(/if \(!user\) return NextResponse\.json\(\{ error: "unauthorized" \}/);
  });

  it("photo lookup uses the SESSION email for members and never trusts client input for them", () => {
    const src = read("src/app/api/photo-suggest/route.ts");
    expect(src).toContain("function emailFor");
    // Signed in → always the session's own email, so one account can't fish
    // for another's avatar by passing an arbitrary address.
    expect(src).toMatch(/if \(user\) return user\.email;/);
  });

  it("a guest's imported photo comes back as a data URL (no account folder yet)", () => {
    const src = read("src/app/api/photo-suggest/route.ts");
    expect(src).toMatch(/if \(!user\)[\s\S]{0,200}data:image\/jpeg;base64/);
  });
});
