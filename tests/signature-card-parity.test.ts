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

const SURFACES: { file: string; label: string }[] = [
  { file: "src/app/card/[username]/page.tsx", label: "public card (source of truth)" },
  { file: "src/app/share/page.tsx", label: "Swift Signature / share captures" },
  { file: "src/app/dashboard/page.tsx", label: "dashboard Your Card preview" },
  { file: "src/app/api/profile/route.ts", label: "legacy profile-card write path" },
];

describe("Swift Signature renders the same card as the live SwiftCard", () => {
  for (const { file, label } of SURFACES) {
    it(`${label} passes the template to sanitizeCustomizationForPlan`, () => {
      const calls = callArgs(read(file), "sanitizeCustomizationForPlan");
      expect(calls.length).toBeGreaterThan(0);
      for (const args of calls) {
        // Assert on the whole argument list rather than a positional index:
        // TypeScript generics (`Record<string, unknown>`) contain commas, so
        // positional splitting is unreliable. Neither the customization nor the
        // paid argument ever mentions a template, so its presence anywhere in
        // the call is an exact signal that the third argument was supplied.
        expect(args.join(",").toLowerCase()).toContain("template");
      }
    });
  }

  it("the signature carries every social field the custom template can render", () => {
    // withoutSocials() blanks socials for all standard templates, so these only
    // surface on "custom", where the data passes through untouched. The share
    // page builds its own CardData and previously omitted snapchat, so a custom
    // card showed Snapchat live but not in the signature.
    const share = read("src/app/share/page.tsx");
    for (const field of ["instagram", "twitter", "tiktok", "linkedin", "snapchat"]) {
      expect(share).toMatch(new RegExp(`\\b${field}:`));
    }
  });

  it("signature and public card apply the identical custom-vs-withoutSocials rule", () => {
    const rule = /template(?:Id)?\s*===\s*"custom"\s*\?\s*\w+\s*:\s*withoutSocials\(/;
    expect(read("src/app/card/[username]/page.tsx")).toMatch(rule);
    expect(read("src/components/EmailSignatureBox.tsx")).toMatch(rule);
  });

  it("both resolve a custom template down to classic-pro when not on Pro", () => {
    // A Free/downgraded account can still have "custom" stored; both surfaces
    // must fall back to the same standard template or the images diverge.
    expect(read("src/app/card/[username]/page.tsx")).toMatch(/=== "custom" && !isPaidPlan\([\s\S]{0,40}?\? "classic-pro"/);
    expect(read("src/app/share/page.tsx")).toMatch(/=== "custom" && !isPro[\s\S]{0,40}?\? "classic-pro"/);
  });
});
