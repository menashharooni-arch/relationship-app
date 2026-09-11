import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// ── "Only you can add link buttons" ─────────────────────────────────────────
//
// The design lock governs how a card LOOKS and says nothing about what is on
// it, so an employee could put any URL they liked on a card carrying the
// company's logo and the office had no way to say no. For a compliance-minded
// buyer that is the objection, not the colours.
//
// Scoped deliberately to the arbitrary link buttons: social profiles are
// normalised to known platforms and a person's own LinkedIn is theirs, as is
// their bio. An unrestricted outbound URL on company letterhead is the thing a
// company needs to be able to refuse.

describe("the setting exists and defaults to OFF", () => {
  const brand = read("src/lib/office-brand.ts");

  it("reads from brand_locks.links", () => {
    expect(brand).toMatch(/lockLinks: locks\?\.links === true/);
  });

  it("is opt-in, unlike the design lock", () => {
    // `=== true` not `!== false`: an office that has never seen this setting
    // must not silently acquire it and start discarding edits its members were
    // allowed to make yesterday. The design lock defaults ON for the opposite
    // reason — a uniform look is the point of an office.
    expect(brand).toMatch(/lockTemplate: locks\?\.template !== false/);
    expect(brand).not.toMatch(/lockLinks: locks\?\.links !== false/);
  });

  it("the brand API stores it alongside the template lock", () => {
    const route = read("src/app/api/office/brand/route.ts");
    expect(route).toMatch(/const lockLinks = body\.lockLinks === true/);
    expect(route).toMatch(/brand_locks: \{ template: lockTemplate, links: lockLinks \}/);
  });
});

describe("the server enforces it — the UI is not the boundary", () => {
  it("an edit keeps the STORED links and discards whatever was sent", () => {
    // CardEditForm sends `links` on every save whether or not it changed, so
    // the guard has to run on the merged result, not on the incoming payload.
    const route = read("src/app/api/cards/[id]/route.ts");
    expect(route).toMatch(/if \(subCtx && brand\?\.lockLinks && updates\.customization\)/);
    expect(route).toMatch(/if \(hadStoredLinks\) merged\.links = storedLinks;/);
    expect(route).toMatch(/else delete merged\.links;/);
  });

  it("restores rather than empties — a lock must never delete existing links", () => {
    const route = read("src/app/api/cards/[id]/route.ts");
    const guard = route.slice(route.indexOf("// LINKS LOCK"), route.indexOf("// Company-level fields are org territory"));
    expect(guard).toContain("storedLinks");
    // Nothing in the guard writes an empty array over what is there.
    expect(guard).not.toMatch(/links = \[\]/);
  });

  it("a new member card starts with none when the office has locked them", () => {
    const route = read("src/app/api/cards/route.ts");
    expect(route).toMatch(/if \(subCtx && brand\.lockLinks\)/);
  });

  it("applies to SUB-USERS only — an owner's own cards stay theirs", () => {
    // Every brand target in the product excludes the owner; this follows it.
    for (const p of ["src/app/api/cards/[id]/route.ts", "src/app/api/cards/route.ts"]) {
      const src = read(p);
      const idx = src.indexOf("lockLinks");
      expect(idx, `${p} does not enforce the lock at all`).toBeGreaterThan(-1);
      expect(src.slice(Math.max(0, idx - 120), idx), `${p} enforces the lock without checking subCtx`).toContain("subCtx");
    }
  });
});

describe("the admin control says what it does", () => {
  const ui = read("src/components/OfficeBranding.tsx");

  it("sends the flag with the rest of the brand", () => {
    expect(ui).toMatch(/lockTemplate, lockLinks \}\)/);
    expect(ui).toMatch(/useState\(office\.brand_locks\?\.links === true\)/);
  });

  it("promises that nothing is deleted, because nothing is", () => {
    expect(ui).toMatch(/Links already on a\s+card stay/);
  });

  it("no longer overstates what the office controls", () => {
    // The "what members still fill in" list named only name/photo/title/phone/
    // email, which would tell a compliance buyer that socials, bio and links
    // were locked. They are not — and links only when this setting is on.
    expect(ui).toContain("Their social profiles");
    expect(ui).toContain("Their bio");
    expect(ui).toMatch(/lockLinks \? \[\] : \["Their link buttons"\]/);
  });

  it("lists link buttons as company-controlled only while locked", () => {
    expect(ui).toMatch(/lockLinks \? \["Link buttons"\] : \[\]/);
  });
});

describe("the member is told why, and shown nothing that silently reverts", () => {
  const form = read("src/app/cards/[id]/edit/CardEditForm.tsx");

  it("carries the lock through from the office brand", () => {
    expect(read("src/app/cards/[id]/edit/page.tsx")).toMatch(/lockLinks: brand\?\.lockLinks \?\? false/);
    expect(form).toMatch(/const linksLocked = !!org\?\.lockLinks/);
  });

  it("replaces the add-link form with an explanation", () => {
    expect(form).toMatch(/\{linksLocked \? \(/);
    expect(form).toMatch(/turned off link buttons on team cards/);
  });

  it("does not promise the admin can add one — that control does not exist yet", () => {
    // The office admin's member-card editor has no links UI, so telling a
    // member to ask for one would be a promise the product cannot keep.
    expect(form).not.toMatch(/Ask them if you need one/);
  });

  it("offers no upgrade path — this is an org setting, not a plan limit", () => {
    // And inside the iOS shell an upgrade CTA here would be a selling surface.
    // Stripped of comments first: the comment beside this branch explains why
    // there is no Pro offer here, and a guard that fires on its own
    // explanation is a guard nobody can keep.
    // Scoped to the LOCKED branch alone. The Free-plan branch sits directly
    // after it and mentions Pro legitimately — that is a plan limit, which is
    // exactly the distinction being drawn here. Comments stripped too, since
    // the one beside this branch explains why there is no Pro offer in it.
    const start = form.indexOf("{linksLocked ? (");
    const end = form.indexOf(") : atLinkCap ? (", start);
    expect(start, "the locked branch moved").toBeGreaterThan(-1);
    expect(end, "the locked branch no longer precedes the plan-cap branch").toBeGreaterThan(start);
    const locked = form
      .slice(start, end)
      .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(locked).not.toContain("/upgrade");
    expect(locked).not.toContain("Pro");
    expect(locked).toContain("turned off link buttons");
  });

  it("keeps existing links VISIBLE but removes the controls that would revert", () => {
    // Hiding them would read as "my links are gone". A remove button that the
    // server undoes on save is worse than no button.
    expect(form).toMatch(/\{!linksLocked && \(\s*<button type="button" onClick=\{\(\) => removeLink\(i\)\}/);
    expect(form).toMatch(/readOnly=\{linksLocked\}/);
  });

  it("omits the per-link style controls instead of letting them silently revert", () => {
    // Those controls edit the SAME links array, so leaving them live would lose
    // the member's changes on save with no explanation.
    expect(form).toMatch(/links=\{linksLocked \? undefined : links\}/);
    expect(form).toMatch(/onLinksChange=\{linksLocked \? undefined : setLinks\}/);
    expect(form).toMatch(/Styling for individual link buttons is set by your organization/);
  });
});
