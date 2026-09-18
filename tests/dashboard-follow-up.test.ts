import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Warm-lead plan PR C3: the dashboard's "Follow up first" card.
const page = readFileSync(join(process.cwd(), "src/app/dashboard/page.tsx"), "utf8");

describe("Follow up first on the dashboard", () => {
  it("scores only this card's visible contacts — never locked Free leads", () => {
    expect(page).toMatch(/visibleLeads\.map\(\(l\) => \(\{ id: l\.id as string, created_at: l\.created_at as string \}\)\)/);
  });

  it("Pro: up to five, hottest and most recent first", () => {
    expect(page).toMatch(/\.sort\(\(a, b\) => compareIntent\(a\.intent, b\.intent\)\)/);
    expect(page).toMatch(/const followUpItems: FollowUpItem\[\] = isPro\s*\?\s*warming\.slice\(0, 5\)/);
  });

  it("Free: only a count reaches the page", () => {
    expect(page).toMatch(/<FollowUpFirst items=\{followUpItems\} warmingCount=\{isPro \? 0 : warming\.length\} card=\{activeUsername\} \/>/);
  });
});
