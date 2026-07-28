import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Light mode in the portal is an override LAYER, not a second set of component
// classes: components are authored dark, and `[data-sc-theme="light"] .sc-app`
// rules in globals.css remap each dark utility onto a cream surface. That works
// only for classes the layer actually names. Anything it misses keeps its dark
// theme colour on a near-white background.
//
// The failure this pins: `text-amber-100/90` on the contact "The AI writes each
// message…" disclaimer was unmapped, so in light mode the sentence rendered
// pale yellow on white and vanished — while the <strong> words inside it, which
// used the mapped text-amber-200, stayed readable. The result was a half-
// visible sentence.
//
// Opacity variants are the trap. Tailwind emits `text-amber-200/80` as its own
// class, so mapping `.text-amber-200` does nothing for it. Thirteen such
// variants were unmapped alongside the reported one.

// Shades light enough to disappear on the cream/white light surface. 400+ is
// mid-tone or darker and reads fine either way.
const LIGHT_SHADE = /text-(?:white|amber|yellow|blue|emerald|green|red|rose|purple|violet|indigo|sky|teal|orange|pink|cyan|lime)-(?:50|100|200|300)(?!\d)(?:\/\d{1,3})?/g;

// Not part of the .sc-app portal, so the light layer never applies to them and
// a light text shade there is not a bug:
//  - components/site: marketing chrome, authored light already.
//  - components/card-templates: renders the user's actual card, whose colours
//    are the customer's own design and must NEVER be themed by the portal.
//  - app/admin: the site-owner console. Verified to carry neither .sc-app nor a
//    ThemeToggle, so it is always dark; requiring mappings there would raise
//    false alarms for rules that could never apply.
const OUTSIDE_PORTAL = /src[\\/](?:components[\\/](?:site|card-templates)|app[\\/]admin)[\\/]/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(root, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (entry.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

// Every .text-* class named anywhere inside the light-theme override layer.
function mappedClasses(): Set<string> {
  const css = read("src/app/globals.css");
  const layer = css.split('[data-sc-theme="light"]').slice(1).join("\n");
  const found = layer.match(/\.text-[a-z]+-\d+(?:\\\/\d+)?/g) ?? [];
  // ".text-amber-200\/80" in CSS is the class "text-amber-200/80" in markup.
  return new Set(found.map((c) => c.slice(1).replace("\\/", "/")));
}

describe("light theme covers every light-coloured text class in the portal", () => {
  it("no portal file uses a light text shade the light layer doesn't remap", () => {
    const mapped = mappedClasses();
    const offenders: string[] = [];

    for (const file of [...walk("src/components"), ...walk("src/app")]) {
      if (OUTSIDE_PORTAL.test(file)) continue;
      const used = read(file).match(LIGHT_SHADE) ?? [];
      for (const cls of new Set(used)) {
        if (!mapped.has(cls)) offenders.push(`${cls}  (${file})`);
      }
    }

    expect(
      offenders,
      "These render near-invisible in light mode. Add them to the matching " +
        '`[data-sc-theme="light"] .sc-app :is(...)` rule in globals.css:\n  ' +
        offenders.join("\n  "),
    ).toEqual([]);
  });

  it("the contact AI-notes disclaimer specifically is remapped", () => {
    // The reported bug, pinned directly: both the container's body text and the
    // emphasised words inside it must be mapped, or the sentence goes back to
    // being half-readable.
    const mapped = mappedClasses();
    for (const cls of ["text-amber-100/90", "text-amber-200"]) {
      expect(mapped.has(cls), `${cls} is not remapped for light mode`).toBe(true);
    }
    expect(read("src/components/ContactsClient.tsx")).toContain("The AI writes each message");
  });
});
