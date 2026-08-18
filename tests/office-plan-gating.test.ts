import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeCustomizationForPlan, PLAN_LIMITS } from "@/lib/plan";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("editing a downgraded card no longer deletes what it can't show", () => {
  const FIVE_LINKS = [1, 2, 3, 4, 5].map((n) => ({ emoji: "🔗", label: `L${n}`, url: `https://x/${n}` }));

  it("DISPLAY still enforces the Free cap", () => {
    const shown = sanitizeCustomizationForPlan({ links: FIVE_LINKS }, false, "classic-pro");
    expect((shown.links as unknown[]).length).toBe(PLAN_LIMITS.FREE_MAX_LINKS);
  });

  it("STORAGE keeps all of them", () => {
    // A downgraded Pro user with five links who edits an unrelated field used
    // to come back with three of them gone from the database. Permanently —
    // re-subscribing restored nothing, because nothing was left to restore.
    const stored = sanitizeCustomizationForPlan({ links: FIVE_LINKS }, false, "classic-pro", {
      preserveDowngraded: true,
    });
    expect((stored.links as unknown[]).length).toBe(5);
  });

  it("STORAGE keeps the Pro colours too — they snapped the same way", () => {
    const cust = { accentColor: "#FF0000", linkBgColor: "#123456" };
    const stored = sanitizeCustomizationForPlan(cust, false, "classic-pro", { preserveDowngraded: true });
    expect(stored.accentColor).toBe("#FF0000");
    expect(stored.linkBgColor).toBe("#123456");

    // ...and display still drops them.
    const shown = sanitizeCustomizationForPlan(cust, false, "classic-pro");
    expect(shown.linkBgColor).toBeUndefined();
  });

  it("paid accounts are unaffected either way", () => {
    const a = sanitizeCustomizationForPlan({ links: FIVE_LINKS }, true, "classic-pro");
    expect((a.links as unknown[]).length).toBe(5);
  });

  it("the two card EDIT paths preserve; nothing else opts in", () => {
    expect(code("src/app/api/cards/[id]/route.ts")).toMatch(/preserveDowngraded: true/);
    expect(code("src/app/api/profile/route.ts")).toMatch(/preserveDowngraded: true/);
    // Create and draft-claim have no stored data to lose, so they must NOT
    // opt in — that would let a brand-new Free card bank Pro values.
    expect(code("src/app/api/cards/route.ts")).not.toMatch(/preserveDowngraded/);
    expect(code("src/lib/draft-claim.ts")).not.toMatch(/preserveDowngraded/);
  });

  it("every render path still sanitizes — that is what makes storing safe", () => {
    // Sanitizing now happens inside buildCardData, which every card-rendering
    // surface goes through. A surface satisfies this by calling the builder OR
    // by sanitizing directly (the card page still does the latter for its page
    // chrome — bio, links, testimonials — which is not part of the card).
    for (const f of [
      "src/app/card/[username]/page.tsx",
      "src/app/dashboard/page.tsx",
      "src/app/share/page.tsx",
    ]) {
      const c = code(f);
      expect(c, `${f} neither sanitizes nor uses the shared builder`)
        .toMatch(/sanitizeCustomizationForPlan\(|buildCardData\(/);
      expect(c, `${f} preserves on RENDER — dormant Pro values would go public`).not.toMatch(
        /preserveDowngraded/,
      );
    }
    // And the builder itself must sanitize, or the above becomes vacuous.
    expect(code("src/lib/card-data.ts")).toMatch(/sanitizeCustomizationForPlan\(/);
    expect(code("src/lib/card-data.ts")).not.toMatch(/preserveDowngraded/);
    // The Swift Links page caps inline rather than via this helper.
    const links = code("src/app/links/[username]/page.tsx");
    expect(links).toMatch(/allActionLinks\.filter\(\(l\) => l\.kind !== "header"\)\.slice\(0, PLAN_LIMITS\.FREE_MAX_LINKS\)/);
  });
});

describe("a lapsed Office owner loses office powers", () => {
  it("the shared capability guard checks the owner's plan", () => {
    const c = code("src/lib/office-roles.ts");
    expect(c).toMatch(/requireOfficeCapability/);
    expect(c, "role resolution still never looks at profiles.plan").toMatch(/isOfficePlan\(/);
    expect(c).toMatch(/\.eq\("id", ctx\.ownerId\)/);
  });

  it("the gate is inherited, not re-implemented per route", () => {
    // /brand and /invite had their own copies; every other office route had
    // none. The point of moving it is that a new route can't forget.
    const c = code("src/lib/office-roles.ts");
    const guardStart = c.indexOf("export async function requireOfficeCapability");
    expect(guardStart).toBeGreaterThan(0);
    const guard = c.slice(guardStart, guardStart + 1400);
    expect(guard).toMatch(/isOfficePlan/);
    expect(guard).toMatch(/return null/);
  });
});

describe("an office owner cannot join another office", () => {
  it("the accept path refuses before it touches anything", () => {
    const c = code("src/app/api/join/route.ts");
    expect(c).toMatch(/from\("offices"\)[\s\S]{0,140}?\.eq\("owner_id", user\.id\)/);
    expect(c).toMatch(/ownedOffice && ownedOffice\.id !== officeId/);
    expect(c).toMatch(/status: 409/);
  });

  it("refuses BEFORE the seat is activated, so there is nothing to roll back", () => {
    const c = code("src/app/api/join/route.ts");
    const guardAt = c.indexOf("ownedOffice && ownedOffice.id !== officeId");
    const activateAt = c.indexOf('status: "active", joined_at');
    expect(guardAt).toBeGreaterThan(0);
    expect(activateAt).toBeGreaterThan(0);
    expect(guardAt, "the guard runs after activation — a rollback path with no rollback").toBeLessThan(activateAt);
  });
});
