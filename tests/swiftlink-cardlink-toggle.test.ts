import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

// ── The "View SwiftCard →" toggle (owner order 2026-09-02) ───────────────────
// Social design gained a switch controlling the faint card link at the bottom
// of the Swift Links page. Pins: shown by DEFAULT everywhere, hidden only by
// an explicit hideCardLink: true, editable from both the wizard and the
// editor, and available on every plan (sanitize must not touch it).
describe("the View SwiftCard button toggle", () => {
  it("the profile hides the link only on the explicit prop, default shown", () => {
    const src = read("src/components/SwiftLinkProfile.tsx");
    expect(src).toMatch(/showCardLink = true,/);
    expect(src).toMatch(/\{showCardLink && \(/);
    expect(src).toContain("View SwiftCard →");
  });

  it("the public page maps hideCardLink !== true → shown", () => {
    expect(read("src/app/links/[username]/page.tsx")).toMatch(/showCardLink=\{customization\.hideCardLink !== true\}/);
  });

  it("both editors carry the switch and persist the flag", () => {
    const wizard = read("src/app/cards/new/NewCardWizard.tsx");
    const editor = read("src/app/cards/[id]/edit/CardEditForm.tsx");
    for (const src of [wizard, editor]) {
      expect(src).toContain("Show the &ldquo;View SwiftCard&rdquo; button");
      expect(src).toMatch(/showCardLinkBtn/);
    }
    // Wizard writes the flag only when hidden (fresh rows stay clean)…
    expect(wizard).toMatch(/showCardLinkBtn \? \{\} : \{ hideCardLink: true \}/);
    // …the editor sends it explicitly both ways, so the server merge can CLEAR it.
    expect(editor).toMatch(/hideCardLink: showCardLinkBtn \? null : true,/);
    // The editor initializes from the stored card, not a hardcoded default.
    expect(editor).toMatch(/useState\(card\.customization\?\.hideCardLink !== true\)/);
  });

  it("the live preview reflects the toggle", () => {
    expect(read("src/components/SwiftLinkLivePreview.tsx")).toMatch(/showCardLink=\{showCardLink\}/);
    expect(read("src/app/cards/new/NewCardWizard.tsx")).toMatch(/showCardLink=\{showCardLinkBtn\}/);
    expect(read("src/app/cards/[id]/edit/CardEditForm.tsx")).toMatch(/showCardLink=\{showCardLinkBtn\}/);
  });

  it("every plan may use it — the Free sanitizer never touches the key", () => {
    expect(read("src/lib/plan.ts")).not.toMatch(/hideCardLink/);
  });
});
