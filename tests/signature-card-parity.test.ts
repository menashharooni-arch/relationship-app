import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// The Swift Signature must be a PIXEL-FAITHFUL copy of the user's live card:
// same template, same colours, same fonts, same fields. Every surface that
// renders a card from stored data has to build its CardData the same way.
//
// The recurring failure mode is dropping the third argument to
// sanitizeCustomizationForPlan. On a FREE account that function snaps colours to
// the nearest preset OF THE GIVEN TEMPLATE, defaulting to "classic-pro" when the
// argument is missing — so a Free user on any other template gets a signature
// (or preview, or export) whose colours don't match their real card. Paid plans
// return early inside the sanitizer and were never affected. This has now been
// introduced three separate times (public card, dashboard, share), so the call
// sites are pinned here.

// Extract the argument list of every `fn(...)` call, honouring nesting. A naive
// regex is NOT sufficient: the identifier being looked for often appears again
// a few lines below the call, so a windowed match reports a false pass.
function callArgs(src: string, fnName: string): string[][] {
  const calls: string[][] = [];
  const needle = `${fnName}(`;
  let idx = src.indexOf(needle);
  while (idx !== -1) {
    let i = idx + needle.length;
    const start = i;
    let depth = 1;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") depth--;
      i++;
    }
    const body = src.slice(start, i - 1);
    const args: string[] = [];
    let d = 0;
    let cur = "";
    for (const ch of body) {
      if (ch === "(" || ch === "[" || ch === "{") d++;
      else if (ch === ")" || ch === "]" || ch === "}") d--;
      if (ch === "," && d === 0) {
        args.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    if (cur.trim()) args.push(cur.trim());
    calls.push(args);
    idx = src.indexOf(needle, i);
  }
  return calls;
}

// These used to check that each surface passed the template to the sanitizer
// ITSELF — three files each doing the same thing correctly. That is a weaker
// guarantee than it looks: it can only catch a surface doing the shared step
// wrong, never one that quietly derives a field differently, which is exactly
// how /share ended up reading snapchat and address out of the RAW blob and the
// dashboard ended up omitting snapchat.
//
// There is one builder now, so the assertions moved to it: the surfaces must
// USE it, and it must do the right thing. tests/card-data-identity.test.ts
// covers its behaviour; this file covers the wiring.
const RENDER_SURFACES: { file: string; label: string }[] = [
  { file: "src/app/[username]/page.tsx", label: "public card (source of truth)" },
  { file: "src/app/share/page.tsx", label: "Swift Signature / share captures" },
  { file: "src/app/dashboard/page.tsx", label: "dashboard Your Card preview" },
];

describe("Swift Signature renders the same card as the live SwiftCard", () => {
  for (const { file, label } of RENDER_SURFACES) {
    it(`${label} builds its card with the shared builder`, () => {
      expect(read(file)).toMatch(/buildCardData\(/);
    });

    it(`${label} does not sanitize its own card customization`, () => {
      // A surface that sanitizes separately has, by definition, its own opinion
      // about what the card looks like. The card page still calls the sanitizer
      // for the page CHROME (bio, links, testimonials); what it must not do is
      // build a second card object from it.
      expect(read(file), "a hand-rolled CardData is back").not.toMatch(/^\s*initials:/m);
    });
  }

  it("the builder passes the card's own template to the sanitizer", () => {
    // The third argument decides which palette a downgraded card snaps to.
    // Omitting it snapped one surface to classic-pro's while another used the
    // real template's, and the signature stopped matching the card.
    const calls = callArgs(read("src/lib/card-data.ts"), "sanitizeCustomizationForPlan");
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) {
      expect(args.join(",").toLowerCase()).toContain("template");
    }
  });

  it("the builder carries every social field the custom template can render", () => {
    // withoutSocials() blanks socials for all standard templates, so these only
    // surface on "custom", where the data passes through untouched.
    const lib = read("src/lib/card-data.ts");
    for (const field of ["instagram", "twitter", "tiktok", "linkedin", "snapchat"]) {
      expect(lib).toMatch(new RegExp(`\\b${field}:`));
    }
  });

  it("signature and public card apply the identical custom-vs-withoutSocials rule", () => {
    const rule = /template(?:Id)?\s*===\s*"custom"\s*\?\s*\w+\s*:\s*withoutSocials\(/;
    expect(read("src/app/[username]/page.tsx")).toMatch(rule);
    expect(read("src/components/EmailSignatureBox.tsx")).toMatch(rule);
  });

  it("the builder resolves a custom template down to classic-pro off Pro", () => {
    // A Free/downgraded account can still have "custom" stored. Decided once,
    // in the builder, so the card and the signature cannot land on different
    // templates.
    expect(read("src/lib/card-data.ts")).toMatch(/=== "custom" && !opts\.isPro[\s\S]{0,40}?\? "classic-pro"/);
  });

  it("the legacy profile write path still sanitizes with a template", () => {
    // Not a render surface — a WRITE path, so it keeps its own call.
    const calls = callArgs(read("src/app/api/profile/route.ts"), "sanitizeCustomizationForPlan");
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) {
      expect(args.join(",").toLowerCase()).toContain("template");
    }
  });
});
