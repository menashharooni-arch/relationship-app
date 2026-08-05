import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// STRUCTURAL GUARD — the marketing demo must not show a product we don't ship.
//
// SignatureDemo renders "a faithful copy of the real LeadCaptureForm". Its
// consent line was a hand-written paragraph, so when the live disclosure
// changed (wording in August, 8px → 10px in July) the demo kept showing the old
// one: visitors were being shown a consent line the product had already
// replaced. Copy drifts silently precisely because nothing links the two.
//
// The fix was to render the REAL component instead of its words, and this pins
// that: any future demo that re-types the disclosure fails here.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// Every surface that shows a mock capture form to a visitor.
const DEMO_SURFACES = [
  "src/components/site/SignatureDemo.tsx",
  "src/components/site/CardMiniBuilder.tsx",
  "src/components/site/SwiftLinkMiniBuilder.tsx",
  "src/app/preview/PreviewClient.tsx",
];

describe("demo forms show the real consent disclosure, not a copy of it", () => {
  it("SignatureDemo renders the actual component", () => {
    const src = read("src/components/site/SignatureDemo.tsx");
    expect(src, "SignatureDemo stopped importing the real disclosure").toMatch(
      /import SmsConsentCheckbox from "@\/components\/SmsConsentCheckbox"/,
    );
    expect(stripComments(src), "SignatureDemo no longer renders it").toMatch(/<SmsConsentCheckbox\s*\/>/);
  });

  it.each(DEMO_SURFACES)("%s doesn't hand-write the disclosure", (file) => {
    let src: string;
    try {
      src = stripComments(read(file));
    } catch {
      return; // surface removed — nothing to police
    }
    // The retired wording, verbatim. Its presence means someone pasted the old
    // consent line back into a mock instead of rendering the component.
    expect(src, `${file} carries the RETIRED consent wording`).not.toMatch(
      /agree to receive follow-up messages by email or text/i,
    );
    // A demo that re-types today's wording is the same bug waiting to happen —
    // it will be wrong the next time the real line changes.
    expect(src, `${file} re-types the live disclosure instead of rendering it`).not.toMatch(
      /Msg frequency varies/,
    );
  });

  it("the real disclosure is still the single source it points at", () => {
    // Without this the assertions above could pass against a component that no
    // longer carries a disclosure at all.
    const real = read("src/components/SmsConsentCheckbox.tsx");
    expect(real).toMatch(/Msg frequency varies/);
    expect(real).toMatch(/STOP to opt out/);
  });
});
