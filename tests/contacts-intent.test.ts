import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Warm-lead plan PR C2: Hot / Warm on the Contacts page.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const page = read("src/app/contacts/page.tsx");
const client = read("src/components/ContactsClient.tsx");

describe("scores on the Contacts page", () => {
  it("are computed at read time for the contacts the page shows", () => {
    expect(page).toMatch(/const intentMap = await loadIntent\(\s*admin,/);
  });

  it("are Pro: Free gets a count, never which contacts or why", () => {
    expect(page).toMatch(/if \(paid\) intents\[id\] = \{ tier: r\.tier, reason: r\.reason, lastEngagedAt: r\.lastEngagedAt \};/);
    expect(page).toMatch(/warmingCount=\{paid \? 0 : warmingCount\}/);
    expect(client).toMatch(/warming up/);
    // The words a Free account actually reads: no plan, no price, no pitch.
    const shown = client.match(/`\$\{warmingCount\} contacts are`\} warming up/);
    expect(shown).not.toBeNull();
    expect(client).toMatch(/\{warmingCount === 1 \? "1 contact is" : `\$\{warmingCount\} contacts are`\} warming up\s*<\/p>/);
  });

  it("never label a contact Cold", () => {
    expect(client).toMatch(/if \(tier !== "hot" && tier !== "warm"\) return null;/);
    expect(client).not.toMatch(/>Cold</);
  });

  it("Follow Up First is Pro, and the old sort says what it really does", () => {
    expect(client).toMatch(/\{isPro && <option value="followup">Follow Up First<\/option>\}/);
    expect(client).toMatch(/<option value="activity">Follow-up Date<\/option>/);
  });

  it("the contact shows why, in the reason's own words", () => {
    expect(client).toMatch(/intents\[selected\.id\]!\.reason/);
  });
});
