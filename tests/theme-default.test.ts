import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Light is the default theme ───────────────────────────────────────────────
//
// Owner decision. The mechanism is easy to revert by accident because the
// ATTRIBUTE still means "light" — only the test that sets it was inverted. A
// well-meaning "fix" back to `=== 'light'` silently returns the whole product
// to dark for every new user, and nothing else would fail.
//
// Two places have to agree: the pre-paint boot script decides what is PAINTED,
// and ThemeToggle decides which ICON is shown. If they disagree, the toggle
// offers to switch you to the theme you are already looking at.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("light is the default, dark is opt-in", () => {
  it("the boot script applies light unless 'dark' was explicitly stored", () => {
    const src = read("src/app/layout.tsx");
    expect(src).toMatch(/localStorage\.getItem\('sc_theme'\)!=='dark'/);
    expect(src, "an === 'light' test would restore the dark default").not.toMatch(
      /localStorage\.getItem\('sc_theme'\)==='light'/,
    );
  });

  it("ThemeToggle reads the default the same way", () => {
    const src = read("src/components/ThemeToggle.tsx");
    expect(src).toMatch(/localStorage\.getItem\("sc_theme"\) === "dark" \? "dark" : "light"/);
    // Comment lines are allowed between `catch {` and the call — an
    // eslint-disable directive has to sit directly above the setState — but
    // nothing else is: the very next STATEMENT must be setTheme("light").
    expect(src, "storage-blocked fallback must match the painted default")
      .toMatch(/catch \{(?:\s*\/\/[^\n]*)*\s*setTheme\("light"\)/);
  });

  it("still applies the theme BEFORE paint", () => {
    // The whole reason this lives in an inline boot script: applied from a
    // React effect, every light-default user sees one frame of dark first.
    const src = read("src/app/layout.tsx");
    const boot = src.slice(src.indexOf('id="sc-boot"'), src.indexOf("ORG_JSONLD") > 0 ? src.length : undefined);
    expect(boot).toMatch(/beforeInteractive/);
  });

  it("an explicit choice still wins in both directions", () => {
    // Nobody who already picked a side gets moved by this change.
    const toggle = read("src/components/ThemeToggle.tsx");
    expect(toggle).toMatch(/localStorage\.setItem\("sc_theme", next\)/);
    expect(toggle).toMatch(/if \(next === "light"\) document\.documentElement\.setAttribute\("data-sc-theme", "light"\)/);
    expect(toggle).toMatch(/else document\.documentElement\.removeAttribute\("data-sc-theme"\)/);
  });
});
