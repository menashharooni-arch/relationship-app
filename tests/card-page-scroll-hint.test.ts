import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── The line under a public card ─────────────────────────────────────────────
//
// Owner, 2026-09-20: "right under the card on the top … lightly say 'Swipe
// down to view socials and more'. It should not take up much space. It should
// be small and in very light-colored writing, not anything bold."
//
// A visitor who only ever sees the card misses the save button, the socials
// and the share-back form — everything the page is for.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const page = read("src/app/[username]/page.tsx");
const css = read("src/app/globals.css");

describe("the scroll hint", () => {
  it("says the owner's sentence, directly under the card", () => {
    const card = page.indexOf("<CardTilt>");
    const hint = page.indexOf("down to view socials and more");
    expect(card).toBeGreaterThan(-1);
    expect(hint, "the hint must come after the card").toBeGreaterThan(card);
    // Inside the card's own block, so it costs one line of text rather than
    // another row of the page's gap-5.
    expect(page.slice(card, hint)).not.toContain("</div>");
  });

  it("is small, light and not bold", () => {
    const hint = page.slice(page.indexOf("<p className=", page.indexOf("</CardTilt>")), page.indexOf("down to view socials and more"));
    expect(hint).toContain("text-[0.6875rem]");
    expect(hint).toContain("text-slate-400");
    expect(hint).not.toMatch(/font-(bold|semibold|medium)/);
  });

  it("says Swipe on a touchscreen and Scroll with a mouse, with no JavaScript", () => {
    expect(page).toContain('<span className="sc-hint-swipe">Swipe</span>');
    expect(page).toContain('<span className="sc-hint-scroll">Scroll</span>');
    // The mouse wording is the DEFAULT, so a browser that answers neither
    // media query still reads sensibly.
    expect(css).toMatch(/\.sc-hint-swipe \{ display: none; \}/);
    expect(css).toMatch(/@media \(any-pointer: coarse\) \{\s*\.sc-hint-swipe \{ display: inline; \}\s*\.sc-hint-scroll \{ display: none; \}/);
  });

  it("never promises socials a card hasn't got", () => {
    expect(page).toMatch(/hasConnectSection \? " down to view socials and more" : ` down to save \$\{firstName\}'s contact`/);
  });

  it("stays off the card-only embed, which is the card and nothing else", () => {
    const embed = page.slice(page.indexOf('if (embed === "card")'), page.indexOf('const theme = cardPageTheme'));
    expect(embed).not.toContain("sc-hint-swipe");
  });
});
