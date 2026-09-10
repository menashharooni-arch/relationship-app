import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const CLAIM = read("src/components/site/HeroClaim.tsx");
const CSS = read("src/app/globals.css");

// The homepage hero pill: "SwiftCard.me/[ full name ]  [Start for free]".
//
// The owner reported two defects on it (2026-09-10): typing made the field jump
// up out of line with "SwiftCard.me/", and a hard outline appeared around the
// pill. Both had the same shape — a rule elsewhere in the app winning against
// this component — so both are pinned here rather than left to be re-broken.

// Pull whole tags, not `<tag[^>]*>` — an arrow function in a prop contains a
// ">" and would cut the match short. And take the span that holds the URL text,
// not the brand mark's span, which is the first one in the file.
const INPUT = CLAIM.match(/<input[\s\S]*?\/>/)![0];
const LABEL_SPAN = CLAIM.match(/<span[^>]*>SwiftCard\.me\//)![0];
// The class LIST, not the whole tag: a JSX comment inside the tag explaining a
// class name would otherwise satisfy an assertion about that class being
// applied. (It did, the first time this was written.)
const INPUT_CLASS = INPUT.match(/className="([^"]*)"/)![1];
const FORM_TAG = CLAIM.match(/<form[\s\S]*?>/)![0];

const sizeClasses = (classList: string) =>
  (classList.match(/(?:^|["\s])(?:sm:)?text-(?:base|\[[^\]]+\]|xs|sm|lg|xl)\b/g) ?? [])
    .map((c) => c.replace(/^["\s]+/, ""))
    .sort();

describe("the two halves of the URL are one line of text", () => {
  // The jump was a font-size mismatch. globals.css floors every form control at
  // 16px under `any-pointer: coarse` so iOS does not zoom the page in on focus.
  // That floor reached the <input> and not the <span> beside it, so on a phone
  // a 16px name sat next to a 14px "SwiftCard.me/", and the taller line box
  // pushed the field up. Whatever the sizes are, they have to be the SAME two.
  it("the label and the input carry identical font sizes", () => {
    const label = sizeClasses(LABEL_SPAN);
    expect(label.length).toBeGreaterThan(0);
    expect(sizeClasses(INPUT_CLASS)).toEqual(label);
  });

  it("neither half drops below the 16px iOS zoom floor on phones", () => {
    // text-base is 16px. A bare text-sm/text-xs here brings the zoom back.
    expect(LABEL_SPAN).toMatch(/\btext-base\b/);
    expect(INPUT_CLASS.split(/\s+/)).toContain("text-base");
    expect(INPUT_CLASS).not.toMatch(/(?:^|\s)text-(?:xs|sm)\b/);
  });

  // The global 16px control floor (`font-size: max(16px, 1em)` under
  // `any-pointer: coarse`) is UNLAYERED, so it outranks a Tailwind utility even
  // when the utility asks for MORE. That flattened this field to 16px next to a
  // 17px label on every coarse-pointer device at `sm` and up — an iPad, or a
  // phone in landscape. globals.css has an escape-hatch list for exactly this;
  // the field opts in through it, which is only safe while every size it asks
  // for is itself >= 16px. Both halves of that contract are pinned here.
  it("the field opts out of the control floor", () => {
    expect(INPUT_CLASS.split(/\s+/)).toContain("sc-claim-field");
    expect(CSS).toMatch(/:is\(input, select, textarea, \[contenteditable\]\):is\([^)]*\.sc-claim-field\)/);
  });

  it("opting out is safe: no size on the field is under 16px", () => {
    const px = (cls: string) => {
      const rem = cls.match(/text-\[([\d.]+)rem\]/);
      if (rem) return parseFloat(rem[1]) * 16;
      return { "text-xs": 12, "text-sm": 14, "text-base": 16, "text-lg": 18, "text-xl": 20 }[
        cls.replace(/^sm:/, "")
      ] ?? NaN;
    };
    const sizes = sizeClasses(INPUT_CLASS);
    expect(sizes.length).toBeGreaterThan(0);
    for (const c of sizes) expect({ class: c, px: px(c) }).toMatchObject({ px: expect.any(Number) });
    expect(sizes.map(px).filter((n) => n < 16)).toEqual([]);
  });

  it("they share a baseline rather than a centre line", () => {
    // items-center on a 16px and a 17px run would leave them a hair off; the
    // label wrapper aligns baselines so the two read as one typed string.
    expect(CLAIM).toMatch(/<label[^>]*className="[^"]*\bitems-baseline\b/s);
  });
});

describe("the ring belongs to the pill, not the input", () => {
  it("the input paints no outline of its own", () => {
    expect(INPUT_CLASS.split(/\s+/)).toContain("focus:outline-none");
  });

  it("the pill answers :focus-within", () => {
    expect(CSS).toMatch(/\.sc-claim:focus-within\s*\{/);
  });

  it("the pill keeps its resting shadow", () => {
    expect(CSS).toMatch(/\.sc-claim\s*\{[^}]*box-shadow/s);
  });

  // The app-wide dark-chrome rule is `:is(input, [tabindex]:not([tabindex="-1"]),
  // …):focus-visible`, which scores (0,3,0) because :is() takes the specificity
  // of its most specific argument. `.sc-claim input:focus-visible` is (0,2,1)
  // and LOSES, so the outline came back the moment the field took focus. Adding
  // :focus-within to the ancestor makes it (0,3,1). If someone simplifies this
  // selector back, the awkward outline the owner reported returns.
  it("the suppressing selector outscores the global focus rule", () => {
    expect(CSS).toMatch(/\.sc-claim:focus-within\s+input:focus-visible\s*\{[^}]*outline:\s*none/s);
  });

  it("no inline box-shadow on the form, which could not answer focus at all", () => {
    const style = CLAIM.match(/<form[\s\S]*?style=\{\{([\s\S]*?)\}\}/);
    expect(style).not.toBeNull();
    expect(style![1]).not.toMatch(/boxShadow/);
  });

  it("motion is dropped for reduced-motion", () => {
    expect(CSS).toMatch(/prefers-reduced-motion[\s\S]{0,200}\.sc-claim\s*\{[^}]*transition:\s*none/s);
  });
});

describe("a full name fits the field on a phone", () => {
  // Measured on a 390px phone: the pill is 350 wide, "SwiftCard.me/" takes 112
  // of it and the button 116, so the field lives on what the paddings and the
  // gap leave behind. At the old spacing that was 86px and "Alex Morgan" needs
  // 97 — the name scrolled and the URL read "SwiftCard.me/lex Morgan". These
  // are the trims that bought it back; re-inflating any one of them below `sm`
  // costs the field 2 to 8px and starts cutting names off again.
  it.each([
    ["left padding", /\bpl-3\b/],
    ["right padding", /\bpr-1\b/],
    ["gap", /\bgap-1\.5\b/],
  ])("the pill's phone %s stays trimmed", (_label, re) => {
    expect(FORM_TAG).toMatch(re);
  });

  it("the button's phone padding stays trimmed", () => {
    expect(CLAIM).toMatch(/<button[^>]*className="[^"]*!px-2\.5\b/s);
  });

  it("desktop spacing is untouched", () => {
    for (const re of [/\bsm:pl-5\b/, /\bsm:pr-2\.5\b/, /\bsm:gap-3\b/]) expect(FORM_TAG).toMatch(re);
    expect(CLAIM).toMatch(/<button[^>]*className="[^"]*sm:!px-6\b/s);
  });

  it("the field grows into whatever space is left", () => {
    expect(INPUT_CLASS.split(/\s+/)).toContain("flex-1");
  });

  // The mark and the words say the same thing; on a phone the mark cost 34px of
  // the one field the pill exists to collect.
  it("the duplicate brand mark is desktop-only", () => {
    expect(CLAIM).toMatch(/className="hidden sm:flex shrink-0"><SwiftCardIcon/);
  });

  // Longer names still scroll while typing — the caret has to stay visible.
  // They must not stay scrolled once the visitor looks away.
  it("the field rewinds to the start of the name on blur", () => {
    expect(CLAIM).toMatch(/onBlur=\{\(e\)\s*=>\s*\{\s*e\.currentTarget\.scrollLeft\s*=\s*0;?\s*\}\}/);
  });
});
