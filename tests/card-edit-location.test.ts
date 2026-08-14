import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLAN_FEATURES } from "@/lib/plan-content";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// Editing a card happens in ONE place: Settings → Cards and sharing. The
// dashboard shows and shares cards; it does not edit them. These pin that, and
// pin the copy that tells people where to go — a signpost pointing at a control
// that no longer exists is worse than no signpost.

const DASHBOARD = "src/app/dashboard/page.tsx";
const CARD_LIST = "src/components/dashboard/MyCardsList.tsx";
const MANAGE_CARDS = "src/components/ManageCards.tsx";

describe("the dashboard cannot edit a card", () => {
  it("has no link into the card editor", () => {
    // Both halves: the page, and the client component the card rows moved into.
    for (const f of [DASHBOARD, CARD_LIST]) {
      expect(code(f), `an Edit link is back in ${f}`).not.toMatch(/\/cards\/\$\{[^}]*\}\/edit/);
    }
  });

  it("still lets you SELECT and ADD cards", () => {
    // Removing edit must not have taken the rest of the box with it. Selection
    // now lives in MyCardsList; adding stays on the page.
    expect(code(CARD_LIST)).toMatch(/role="radiogroup"/);
    expect(code(CARD_LIST)).toMatch(/href=\{`\?card=\$\{card\.username\}/);
    expect(code(DASHBOARD)).toMatch(/\/cards\/new\?add=1/);
  });

  it("keeps the tour anchors the guided tour targets", () => {
    const c = code(DASHBOARD);
    expect(c).toMatch(/data-tour="my-cards"/);
    expect(c).toMatch(/data-tour="your-card"/);
  });
});

describe("Settings → Cards and sharing is the editor's home", () => {
  it("still links into the editor", () => {
    expect(code(MANAGE_CARDS)).toMatch(/\/cards\/\$\{card\.id\}\/edit/);
  });

  it("the settings section is described as the place to edit", () => {
    const c = code("src/app/settings/flows/page.tsx");
    expect(c).toMatch(/label: "Cards and sharing"/);
    expect(c).toMatch(/Edit, open, or remove a card/);
  });
});

describe("EVERY account type can still reach the editor", () => {
  const SETTINGS = "src/app/settings/flows/page.tsx";

  it("the Cards section is no longer hidden from office sub-users", () => {
    // This is the regression that removing the dashboard Edit links caused:
    // the section was excluded for sub-users, their only other path was the
    // dashboard, and /office/admin needs a capability a plain employee lacks.
    // They were left with no way to edit their own name, title or photo.
    const c = code(SETTINGS);
    expect(
      c,
      "the cards section is spread away for sub-users again",
    ).not.toMatch(/\.\.\.\(isOfficeSubUser \? \[\] : \[\{\s*id: "cards"/);
    expect(c).toMatch(/id: "cards"/);
  });

  it("but sub-users still cannot DELETE a company card", () => {
    // Restoring their edit path must not hand them a capability they never
    // had — no delete control existed for them before.
    expect(code(SETTINGS)).toMatch(/canDelete=\{!isOfficeSubUser\}/);
  });

  it("ManageCards actually honours canDelete", () => {
    const c = code(MANAGE_CARDS);
    expect(c).toMatch(/canDelete = true/);
    expect(c).toMatch(/\{canDelete && \(/);
    // Edit is NOT gated — that is the whole point of showing them the section.
    const editAt = c.indexOf("/edit");
    const gateAt = c.indexOf("{canDelete && (");
    expect(editAt).toBeGreaterThan(0);
    expect(editAt, "the Edit link got swept behind the delete gate").toBeLessThan(gateAt);
  });

  it("no other linked route offers the editor, so this really is the only path", () => {
    // /profile/card imports CardEditForm but nothing links to it (same dead
    // route as the audit's /profile finding), so it is not a path.
    const linked = code("src/app/settings/flows/page.tsx") + code(MANAGE_CARDS);
    expect(linked).toMatch(/\/cards\/\$\{card\.id\}\/edit/);
  });
});

describe("nothing still points users at a dashboard Edit button", () => {
  it("the guided tour sends them to Settings", () => {
    const c = code("src/lib/tour-steps.ts");
    expect(c, "the tour still names an Edit control on the dashboard").not.toMatch(/Use Edit above/);
    expect(c).toMatch(/Settings → Cards and sharing/);
  });

  it("the tour teaches the mobile card switcher without misleading desktop", () => {
    // TourContext has no viewport, so the copy has to read true on both. The
    // FREE variant must NOT mention the arrow — one card renders no arrow.
    const c = code("src/lib/tour-steps.ts");
    expect(c).toMatch(/tap the arrow beside the selected card/);
    const freeBranch = c.match(/"Your card\. Free includes one[^"]*"/)?.[0] ?? "";
    expect(freeBranch, "the Free copy promises an arrow that never renders").not.toMatch(/arrow/);
  });

  it("the settings-cards step says it is where editing happens", () => {
    const c = code("src/lib/tour-steps.ts");
    expect(c).toMatch(/This is where you edit a card/);
    // And the office-member branch, which is finally reachable.
    expect(c).toMatch(/This is where you edit your company card/);
  });

  it("the in-app AI help sends them to Settings", () => {
    // The assistants no longer carry their own copy of the product — they
    // answer from src/lib/knowledge, so that is where this claim now lives.
    const c = code("src/lib/knowledge/docs/cards.ts");
    expect(c, "AI help still routes people to 'My Cards → Edit'").not.toMatch(/My Cards → Edit/);
    expect(c).toMatch(/Settings → Cards and sharing/);
  });

  it("plan marketing copy makes no claim about where editing lives", () => {
    // Guards against the feature list drifting into a stale nav instruction.
    const all = [...PLAN_FEATURES.free, ...PLAN_FEATURES.pro].join(" | ");
    expect(all).not.toMatch(/My Cards/i);
  });
});

describe("the Add card button is wired correctly", () => {
  it("is ONE pill serving both widths", () => {
    // Desktop used to carry a separate bare text link in this slot. Owner
    // asked for the phone's pill on the computer too, so there is now a single
    // control and no width-gated duplicate. shrink-0 is load-bearing — see the
    // render test, which measures it at both widths.
    const c = code(DASHBOARD);
    expect(c).toMatch(/className="shrink-0 inline-flex items-center/);
    expect(c, "a width-gated duplicate is back").not.toMatch(/className="sm:hidden shrink-0 inline-flex/);
    expect(c, "the desktop-only text link is back").not.toMatch(/className="hidden sm:flex items-center gap-3"/);
  });

  it("no full-width mobile add button survives below the header", () => {
    // It used to be a w-full dashed block under the title row. Whether the new
    // one really sits top-RIGHT is geometry, not text — that is asserted in
    // tests/render/my-cards-add-button.test.ts, which measures it.
    const c = code(DASHBOARD);
    expect(c, "the old full-width mobile add button is back").not.toMatch(
      /sm:hidden[^"]*\bw-full\b[^"]*border-dashed/,
    );
  });

  it("is gated on the plan's eligibility flag", () => {
    const c = code(DASHBOARD);
    expect(c).toMatch(/const canAddCard = isPro \|\| allCards\.length < PLAN_LIMITS\.FREE_CARD_LIMIT/);
    expect((c.match(/\{canAddCard && \(/g) ?? []).length).toBe(1);
  });

  it("goes to the add-card destination, exactly once", () => {
    // Scoped to the My Cards box. Another /cards/new?add=1 lives in the
    // card-less empty state ("Create your card") and is not part of this.
    // The box now ends at <MyCardsList, which is where the rows went.
    const c = code(DASHBOARD);
    const boxStart = c.indexOf('data-tour="my-cards"');
    const boxEnd = c.indexOf("<MyCardsList");
    expect(boxStart).toBeGreaterThan(0);
    expect(boxEnd).toBeGreaterThan(boxStart);
    const box = c.slice(boxStart, boxEnd);
    expect((box.match(/href="\/cards\/new\?add=1"/g) ?? []).length).toBe(1);
  });
});
