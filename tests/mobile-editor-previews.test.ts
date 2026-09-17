import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const EDITOR = "src/app/cards/[id]/edit/CardEditForm.tsx";
const WIZARD = "src/app/cards/new/NewCardWizard.tsx";

/** Index of the first occurrence, asserting it exists. */
function at(src: string, needle: string, label: string): number {
  const i = src.indexOf(needle);
  expect(i, `${label} not found`).toBeGreaterThan(-1);
  return i;
}

// On a phone the preview used to sit above the entire form on every step,
// pushing the fields off-screen — and on the two steps that edit the Swift
// Links page it previewed the CARD, which shows none of what those steps
// change. Each step now places its own preview, of the right kind, at the point
// in the form where it belongs. Desktop keeps the pinned right column.

describe("card editor — one preview per tab, of the right kind", () => {
  const src = () => code(EDITOR);

  it("Card info: the CARD preview comes after the fax field", () => {
    const s = src();
    const fax = at(s, "Fax number", "fax field");
    const preview = at(s, 'mobileCardPreview("Your changes appear here instantly.")', "card-info preview");
    expect(preview, "the preview is above the fax field").toBeGreaterThan(fax);
  });

  it("Card design: the CARD preview is pinned at the top of the tab", () => {
    const s = src();
    const tab = at(s, 'tab === "design" &&', "design tab");
    const preview = at(s, "<PinnedCardPreview>{cardTemplateEl}</PinnedCardPreview>", "card-design preview");
    const photos = s.indexOf('label="Logo & headshot"', tab);
    expect(preview).toBeGreaterThan(tab);
    expect(preview, "the pinned preview dropped below Logo & headshot").toBeLessThan(photos);
  });

  it("Socials: the SWIFT LINKS preview comes after the additional links", () => {
    const s = src();
    const links = at(s, "Additional links", "additional links section");
    const preview = at(s, 'mobileLinkPreview("Your bio, socials and links appear here.")', "socials preview");
    expect(preview).toBeGreaterThan(links);
  });

  it("Socials shows the Swift Links page, NOT the card", () => {
    // The whole point: bio, socials and link buttons appear on the Swift Links
    // page and on nothing else.
    const s = src();
    const start = at(s, 'tab === "sharing" &&', "sharing tab");
    const end = at(s, 'tab === "linkdesign" &&', "linkdesign tab");
    const sharing = s.slice(start, end);
    expect(sharing).toMatch(/mobileLinkPreview\(/);
    expect(sharing, "the Socials tab still previews the card on mobile").not.toMatch(/mobileCardPreview\(/);
  });

  it("Social design: the SWIFT LINKS preview is pinned at the top of the step", () => {
    const s = src();
    const preview = at(s, "<PinnedLinkPreview>{linkPreviewInner}</PinnedLinkPreview>", "social-design preview");
    const controls = at(s, "<SwiftLinkStyleControls", "style controls");
    expect(preview, "the preview dropped below the controls").toBeLessThan(controls);
  });
});

describe("add-card wizard — the same four placements", () => {
  const src = () => code(WIZARD);

  it("step 1: the CARD preview comes after the fax field", () => {
    const s = src();
    const fax = at(s, "Fax number", "fax field");
    const preview = at(s, '<div className="lg:hidden">{livePreview}</div>', "step 1 preview");
    expect(preview).toBeGreaterThan(fax);
  });

  it("step 1: and before the Next button, not stranded past it", () => {
    const s = src();
    const preview = at(s, '<div className="lg:hidden">{livePreview}</div>', "step 1 preview");
    const next = at(s, "Next: Card design", "step 1 next button");
    expect(preview).toBeLessThan(next);
  });

  it("step 2: the CARD preview is pinned at the top of the step", () => {
    const s = src();
    const step2 = at(s, "{step === 2 && (", "step 2");
    const preview = at(s, "<PinnedCardPreview>{cardTemplateEl}</PinnedCardPreview>", "step 2 preview");
    const title = s.indexOf(">Card design</h1>", step2);
    expect(preview).toBeGreaterThan(step2);
    expect(preview, "the pinned preview dropped below the step title").toBeLessThan(title);
  });

  it("step 3: the SWIFT LINKS preview comes after the additional links", () => {
    const s = src();
    const links = at(s, "Additional links", "additional links section");
    const preview = s.indexOf('<div className="lg:hidden">{mobileLinkPagePreview}</div>', links);
    expect(preview, "step 3 preview not found after the links").toBeGreaterThan(links);
  });

  it("step 4: the SWIFT LINKS preview stays above the style controls", () => {
    const s = src();
    const step4 = at(s, "{step === 4 && (", "step 4");
    const preview = s.indexOf("<PinnedLinkPreview>{linkPageEl}</PinnedLinkPreview>", step4);
    const controls = s.indexOf("<SwiftLinkStyleControls", step4);
    expect(preview).toBeGreaterThan(step4);
    expect(preview, "the preview dropped below the controls").toBeLessThan(controls);
  });
});

describe("the Swift Links preview is capped to a mini-phone on mobile", () => {
  it("both surfaces cap it at the same width", () => {
    // SwiftLinkLivePreview renders the real profile at 390px and CardScaler
    // shrinks it to its slot, so a full-width phone slot gave ~0.9 scale — a
    // preview as tall as the screen previewing it.
    expect(code(EDITOR)).toMatch(/max-w-\[220px\] mx-auto/);
    expect(code(WIZARD)).toMatch(/max-w-\[220px\] mx-auto/);
  });

  it("the card preview is NOT capped — it is a wide, short shape", () => {
    const s = code(EDITOR);
    const start = at(s, "const mobileCardPreview", "mobileCardPreview");
    const end = at(s, "const mobileLinkPreview", "mobileLinkPreview");
    expect(s.slice(start, end)).not.toMatch(/max-w-\[220px\]/);
  });
});

describe("desktop is untouched", () => {
  it("the editor's pinned column is desktop-only and still sticky", () => {
    const c = code(EDITOR);
    expect(c).toMatch(/hidden lg:block order-1 lg:order-2 lg:sticky lg:top-6/);
  });

  it("the wizard's pinned column is desktop-only and still sticky", () => {
    expect(code(WIZARD)).toMatch(/hidden lg:block lg:order-2 lg:sticky lg:top-6/);
  });

  it("BOTH Swift Links tabs show the links preview on desktop too", () => {
    // Was the reverse: desktop showed the CARD on the Socials tab, with a
    // caption apologising that the card doesn't show any of what you're
    // editing. Mobile had already been fixed; this is desktop catching up.
    const c = code(EDITOR);
    expect(c).toMatch(/tab === "linkdesign" \|\| tab === "sharing" \? \(/);
    expect(c, "the apology caption is back, so the card preview must be too")
      .not.toMatch(/the card above only shows your name, title/);
  });

  it("the wizard previews the links page on BOTH Swift Links steps", () => {
    expect(code(WIZARD)).toMatch(/step === 3 \|\| step === 4 \? linkPagePreview : livePreview/);
  });

  it("the card preview is still what steps 1-2 / the card tabs show", () => {
    // The swap must not have leaked onto the tabs that really do edit the card.
    expect(code(EDITOR)).toMatch(/\{cardPreviewInner\}/);
    expect(code(WIZARD)).toMatch(/: livePreview\}/);
  });

  it("each Swift Links surface names what THAT step changes", () => {
    // One preview shared by two steps, so a single caption would be wrong on
    // one of them — "as you pick colors and fonts" on the Socials step.
    // The editor's Social design tab has no caption any more: its preview is
    // the pinned one. The wizard's shared inline copy still names each step.
    expect(code(EDITOR)).toMatch(/Your bio, socials and links appear here/);
    const w = code(WIZARD);
    expect(w).toMatch(/Your bio, socials and links appear here/);
    expect(w).toMatch(/It updates live as you pick colors and fonts/);
  });

  it("both previews are defined once and shared, so the two can't drift", () => {
    const c = code(EDITOR);
    expect((c.match(/<PreviewTemplate data=/g) ?? []).length, "card preview duplicated").toBe(1);
    expect((c.match(/<SwiftLinkLivePreview/g) ?? []).length, "link preview duplicated").toBe(1);
  });
});

// The pinned preview (owner, 2026-09-16): on a phone the Card design card sits
// at the top of the step and STAYS on screen while everything below scrolls —
// "I don't want it to just stay on the top and then disappear when they
// scroll". It replaced an inline preview plus a dock that appeared only after
// the inline one left view.
describe("Card design — the pinned preview", () => {
  const PIN = "src/components/PinnedCardPreview.tsx";

  it("is CSS-sticky to the top of the screen on phones only", () => {
    const d = code(PIN);
    expect(d).toMatch(/lg:hidden sticky/);
    expect(d).toMatch(/safe-area-inset-top/);
    expect(d, "it must paint the page canvas so controls never show through").toMatch(/sc-pinned-preview/);
    expect(d).toMatch(/InertPreview/);
  });

  it("the old scroll-triggered dock is gone from both editors", () => {
    for (const f of [EDITOR, WIZARD]) {
      expect(code(f), f).not.toMatch(/DockedCardPreview|design-inline-preview/);
    }
  });

  it("Social design pins the Swift Links page the same way in both editors", () => {
    expect(code(EDITOR)).toContain("<PinnedLinkPreview>{linkPreviewInner}</PinnedLinkPreview>");
    expect(code(WIZARD)).toContain("<PinnedLinkPreview>{linkPageEl}</PinnedLinkPreview>");
  });

  it("tapping a pinned preview opens it full size, above everything", () => {
    const d = code(PIN);
    expect(d).toContain("onClick={expand}");
    expect(d, "the full view must escape the sticky strip's stacking context").toContain("createPortal(");
    expect(d).toMatch(/aria-modal="true"/);
  });

  it("both editors render the same card element in it", () => {
    for (const f of [EDITOR, WIZARD]) {
      expect(code(f), f).toContain("<PinnedCardPreview>{cardTemplateEl}</PinnedCardPreview>");
    }
  });
});
