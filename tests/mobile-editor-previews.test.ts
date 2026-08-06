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

  it("Card design: the CARD preview sits between templates and colours", () => {
    const s = src();
    const templates = at(s, "{TEMPLATES.map(", "template grid");
    const preview = at(s, 'mobileCardPreview("Pick a template above', "card-design preview");
    const colours = at(s, "Customize colors", "colour controls");
    expect(preview).toBeGreaterThan(templates);
    expect(preview, "the preview is below the colour controls").toBeLessThan(colours);
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

  it("Social design: the SWIFT LINKS preview stays at the top of the step", () => {
    const s = src();
    const preview = at(s, 'mobileLinkPreview("It updates live', "social-design preview");
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

  it("step 2: the CARD preview sits between templates and colours", () => {
    const s = src();
    const preview = at(s, '<div className="lg:hidden mt-4">{livePreview}</div>', "step 2 preview");
    const colours = at(s, "Customize colors", "colour controls");
    expect(preview).toBeLessThan(colours);
  });

  it("step 2 no longer pins a sticky preview over the top of the step", () => {
    expect(src(), "the sticky top preview is back").not.toMatch(/lg:hidden sticky top-2/);
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
    const preview = s.indexOf("{mobileLinkPagePreview}", step4);
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

  it("the editor's Socials tab still shows the CARD preview on desktop", () => {
    // Scoped to the phone this pass — desktop keeps its existing behaviour and
    // its explanatory caption.
    const c = code(EDITOR);
    expect(c).toMatch(/the card above only shows your name, title/);
  });

  it("both previews are defined once and shared, so the two can't drift", () => {
    const c = code(EDITOR);
    expect((c.match(/<PreviewTemplate data=/g) ?? []).length, "card preview duplicated").toBe(1);
    expect((c.match(/<SwiftLinkLivePreview/g) ?? []).length, "link preview duplicated").toBe(1);
  });
});
