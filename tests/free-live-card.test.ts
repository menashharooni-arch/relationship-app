import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { pickFreeLiveCardIds } from "@/lib/card-active";
import { PLAN_LIMITS } from "@/lib/plan";

// Which card a Free account keeps live after Pro ends. The owner's rule
// (2026-09-16): the person picks; if they never do, the OLDEST card stays live —
// which is exactly what every existing Free account already gets.

describe("pickFreeLiveCardIds", () => {
  const cards = ["oldest", "middle", "newest"]; // created_at ascending

  it("keeps the oldest card when nothing was chosen (today's rule)", () => {
    expect(pickFreeLiveCardIds(cards, null)).toEqual(["oldest"]);
    expect(pickFreeLiveCardIds(cards, undefined)).toEqual(["oldest"]);
  });

  it("keeps the chosen card instead", () => {
    expect(pickFreeLiveCardIds(cards, "middle")).toEqual(["middle"]);
  });

  it("ignores a choice that is not one of this account's cards", () => {
    // A deleted card (the FK nulls it, but a stale read must not matter) or
    // someone else's id must never switch off the account's real card.
    expect(pickFreeLiveCardIds(cards, "someone-elses")).toEqual(["oldest"]);
  });

  it("never returns more than the Free limit", () => {
    expect(pickFreeLiveCardIds(cards, "newest").length).toBe(PLAN_LIMITS.FREE_CARD_LIMIT);
  });

  it("handles an account with no cards", () => {
    expect(pickFreeLiveCardIds([], "anything")).toEqual([]);
  });
});

describe("one statement of the live-card rule", () => {
  // The rule used to be written out four times ("slice to FREE_CARD_LIMIT").
  // A copy that ignores the chosen card would publish a card the person
  // switched off, or refuse edits to the one they kept.
  const read = (p: string) => readFileSync(p, "utf8");

  it("the card editor, /share and the dashboard list all use the helper", () => {
    expect(read("src/app/api/cards/[id]/route.ts")).toContain("freeLiveCardIds(user.id)");
    expect(read("src/app/share/page.tsx")).toContain("pickFreeLiveCardIds(");
    expect(read("src/app/dashboard/page.tsx")).toContain("liveCardIds={pickFreeLiveCardIds(");
    expect(read("src/lib/card-active.ts")).toMatch(/cardWithinPlanLimit[\s\S]*freeLiveCardIds\(userId\)/);
  });

  it("no inline oldest-card slice remains", () => {
    expect(read("src/app/api/cards/[id]/route.ts")).not.toMatch(/slice\(0, PLAN_LIMITS\.FREE_CARD_LIMIT\)/);
    expect(read("src/app/share/page.tsx")).not.toMatch(/slice\(0, PLAN_LIMITS\.FREE_CARD_LIMIT\)/);
  });
});
