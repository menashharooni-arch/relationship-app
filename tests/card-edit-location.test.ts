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
const MANAGE_CARDS = "src/components/ManageCards.tsx";

describe("the dashboard cannot edit a card", () => {
  it("has no link into the card editor", () => {
    const c = code(DASHBOARD);
    expect(c, "an Edit link is back on the dashboard").not.toMatch(/\/cards\/\$\{[^}]*\}\/edit/);
  });

  it("still lets you SELECT and ADD cards", () => {
    // Removing edit must not have taken the rest of the box with it.
    const c = code(DASHBOARD);
    expect(c).toMatch(/role="radiogroup"/);
    expect(c).toMatch(/\/cards\/new\?add=1/);
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
    expect(c).toMatch(/desc: "Edit, open, or remove a card/);
  });
});

describe("nothing still points users at a dashboard Edit button", () => {
  it("the guided tour sends them to Settings", () => {
    const c = code("src/lib/tour-steps.ts");
    expect(c, "the tour still names an Edit control on the dashboard").not.toMatch(/Use Edit above/);
    expect(c).toMatch(/Settings → Cards and sharing/);
  });

  it("the in-app AI help sends them to Settings", () => {
    const c = code("src/app/api/ai/help/route.ts");
    expect(c, "AI help still routes people to 'My Cards → Edit'").not.toMatch(/My Cards → Edit/);
    expect(c).toMatch(/Settings → Cards and sharing/);
  });

  it("plan marketing copy makes no claim about where editing lives", () => {
    // Guards against the feature list drifting into a stale nav instruction.
    const all = [...PLAN_FEATURES.free, ...PLAN_FEATURES.pro].join(" | ");
    expect(all).not.toMatch(/My Cards/i);
  });
});

describe("the mobile Add card button is wired correctly", () => {
  it("renders on mobile only, and the desktop link on desktop only", () => {
    const c = code(DASHBOARD);
    expect(c).toMatch(/className="sm:hidden flex items-center justify-center/);
    expect(c).toMatch(/className="hidden sm:flex items-center gap-3"/);
  });

  it("both controls share one eligibility flag, so they can't disagree", () => {
    const c = code(DASHBOARD);
    expect(c).toMatch(/const canAddCard = isPro \|\| allCards\.length < PLAN_LIMITS\.FREE_CARD_LIMIT/);
    expect((c.match(/\{canAddCard && \(/g) ?? []).length).toBe(2);
  });

  it("both go to the same add-card destination", () => {
    // Scoped to the My Cards box. A third /cards/new?add=1 lives in the
    // card-less empty state ("Create your card") and is not part of this.
    const c = code(DASHBOARD);
    const boxStart = c.indexOf('data-tour="my-cards"');
    const boxEnd = c.indexOf('role="radiogroup"');
    expect(boxStart).toBeGreaterThan(0);
    expect(boxEnd).toBeGreaterThan(boxStart);
    const box = c.slice(boxStart, boxEnd);
    expect((box.match(/href="\/cards\/new\?add=1"/g) ?? []).length).toBe(2);
  });
});
