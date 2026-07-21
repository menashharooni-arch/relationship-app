import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// Editor previews are look-only: the card templates they render contain real
// tel:/mailto:/social chrome, which must never be clickable, focusable, or
// keyboard-activatable inside an editor. The SAME templates on a published card
// must stay fully interactive — so this pins both halves.

const EDITOR_PREVIEWS = [
  "src/app/cards/new/NewCardWizard.tsx",
  "src/app/cards/[id]/edit/CardEditForm.tsx",
  "src/components/site/CardMiniBuilder.tsx",
  "src/components/site/SwiftLinkMiniBuilder.tsx",
  "src/components/site/SignatureMiniBuilder.tsx",
  "src/components/OfficeBranding.tsx",
];

// Rendering the real card, for real, for the public. Must NOT be locked.
const PUBLIC_SURFACES = [
  "src/app/card/[username]/page.tsx",
  "src/app/links/[username]/page.tsx",
];

describe("editor previews are non-interactive", () => {
  it("InertPreview blocks pointer, focus, keyboard AND assistive-tech entry", () => {
    const src = read("src/components/InertPreview.tsx");
    // `inert` is what actually removes the subtree from focus/tab/click/AT.
    expect(src).toMatch(/\binert\b/);
    // Belt-and-braces for engines that lag on inert.
    expect(src).toContain("pointerEvents");
    expect(src).toContain('data-preview-locked="true"');
  });

  for (const file of EDITOR_PREVIEWS) {
    it(`${file} renders its live preview inside InertPreview`, () => {
      const src = read(file);
      expect(src).toContain("InertPreview");
      expect(src).toContain('from "@/components/InertPreview"');
    });
  }

  for (const file of PUBLIC_SURFACES) {
    it(`${file} does NOT lock its card — published phone/email/links stay clickable`, () => {
      expect(read(file)).not.toContain("InertPreview");
    });
  }
});

describe("click-the-preview-to-edit is gone", () => {
  it("the card editor no longer turns its preview into a tap target", () => {
    const src = read("src/app/cards/[id]/edit/CardEditForm.tsx");
    // The old feature: a <button> wrapping the preview that jumped to the
    // colour controls, plus its "tap the card" affordance copy.
    expect(src).not.toContain("jumpToStyleControls");
    expect(src).not.toContain("styleControlsRef");
    expect(src).not.toContain("styleFlash");
    expect(src).not.toMatch(/Tap the card to edit/i);
    expect(src).not.toMatch(/Tap to change this card's colou?rs/i);
  });

  it("no editor preview is wrapped in a clickable element", () => {
    for (const file of EDITOR_PREVIEWS) {
      const src = read(file);
      // A <button> immediately wrapping the scaled card preview is the shape
      // the removed feature used; it must not come back anywhere.
      expect(src, file).not.toMatch(/<button[^>]*>\s*(\{\/\*[\s\S]*?\*\/\}\s*)?<CardScaler>/);
    }
  });
});
