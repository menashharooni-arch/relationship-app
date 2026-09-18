import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Warm-lead plan PR C5 (owner decision D6): the office admin sees the team's
// Hot and Warm contacts.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const lib = read("src/lib/office-leads.ts");

describe("the team's Follow up first", () => {
  it("is scoped to this office's team, like the Leads table", () => {
    expect(lib).toMatch(/const bySlug = await officeSlugMap\(officeId\);/);
    expect(lib).toMatch(/\.in\("id", candidateIds\)\s*\.in\("card_owner", slugs\)/);
  });

  it("only scores contacts with recent stamped activity, capped", () => {
    expect(lib).toMatch(/not\("lead_id", "is", null\)\.gte\("viewed_at", since\)/);
    expect(lib).toMatch(/\.slice\(0, TEAM_CANDIDATE_CAP\)/);
  });

  it("says which member each contact belongs to, hottest first, never Cold", () => {
    expect(lib).toMatch(/\.filter\(\(x\) => x\.intent && x\.intent\.tier !== "cold"\)/);
    expect(lib).toMatch(/\.sort\(\(a, b\) => compareIntent\(a\.intent!, b\.intent!\)\)/);
    expect(lib).toMatch(/capturedBy: bySlug\.get\(lead\.card_owner as string\)/);
  });

  it("never blocks or hides the Leads table, and hides itself when empty", () => {
    expect(read("src/app/office/admin/leads/page.tsx")).toMatch(/getOfficeFollowUp\(officeId\)\.catch\(\(\) => \[\]\)/);
    expect(read("src/app/office/admin/leads/TeamFollowUp.tsx")).toMatch(/if \(!items\.length\) return null;/);
  });
});
