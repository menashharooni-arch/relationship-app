import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// Modern accounts get a blank profile handle and a SEPARATE card slug, so
// /card/<account handle> is refused. Three surfaces built their public URL
// from profiles.username and all three 404'd — hidden because pre-migration
// accounts, where the two coincide, work fine.

describe("public card links resolve to a card slug, not the account handle", () => {
  it("the shared resolver prefers a real card and falls back", () => {
    const c = code("src/lib/owner-usernames.ts");
    expect(c).toMatch(/export async function publicCardSlug/);
    expect(c).toMatch(/from\("cards"\)/);
    expect(c).toMatch(/order\("created_at", \{ ascending: true \}\)/);
    // Null when there is no card at all, so callers can hide the affordance.
    expect(c).toMatch(/Promise<string \| null>/);
  });

  it("Grow's Share-your-live-card CTA uses it", () => {
    const c = code("src/app/grow/page.tsx");
    expect(c).toMatch(/publicCardSlug\(user\.id\)/);
    expect(c, "still builds the URL from the account handle").not.toMatch(
      /card\/\$\{profile\.username\}/,
    );
  });

  it("the scanner's emailed card link uses it", () => {
    const c = code("src/app/api/scanner/send/route.ts");
    expect(c).toMatch(/publicCardSlug\(user\.id\)/);
  });

  it("the office team drawer's View/Copy/QR use a card slug", () => {
    // The drawer builds `${appUrl}/card/${person.username}`, so the fix is at
    // the source of that field.
    const c = code("src/lib/office-analytics.ts");
    expect(c).toMatch(/username: \(slugs\[0\]\?\.username as string\) \|\| \(prof\?\.username as string\) \|\| ""/);
  });
});

describe("the share page only offers cards that actually serve", () => {
  it("filters the selectable cards by the Free card limit", () => {
    const c = code("src/app/share/page.tsx");
    expect(c).toMatch(/shareableCards = isPro \? allCards : allCards\.slice\(0, PLAN_LIMITS\.FREE_CARD_LIMIT\)/);
    expect(c).toMatch(/shareableCards\.find\(/);
  });

  it("still renders something when every card is past the cap", () => {
    // Falling through to allCards[0] beats a crash; the card page's own 404 is
    // then the honest outcome.
    expect(code("src/app/share/page.tsx")).toMatch(/\?\? shareableCards\[0\] \?\? allCards\[0\]/);
  });
});

describe("contacts count, export and list describe the same card", () => {
  it("the client mirrors its filter into the URL the server reads", () => {
    const c = code("src/components/ContactsClient.tsx");
    expect(c).toMatch(/syncCardParam/);
    expect(c).toMatch(/params\.set\("card", next\)/);
    expect(c).toMatch(/params\.delete\("card"\)/);
  });

  it("uses replace, not push, and does not jump the scroll position", () => {
    const c = code("src/components/ContactsClient.tsx");
    expect(c).toMatch(/router\.replace\(/);
    expect(c).toMatch(/scroll: false/);
  });

  it("every filter mutation goes through the synced setter", () => {
    const c = code("src/components/ContactsClient.tsx");
    // setCardFilter may appear in the state declaration, inside selectCard, and
    // in the one-time hydration effect (which syncs right after). Any OTHER
    // call site would silently desync the header again.
    const calls = c.match(/setCardFilter\(/g) ?? [];
    expect(calls.length, "an unsynced setCardFilter call was added").toBeLessThanOrEqual(2);
    expect(c).toMatch(/selectCard\(l\.card_owner\)/);
  });

  it("the server derives BOTH the count and the export href from ?card=", () => {
    const c = code("src/app/contacts/page.tsx");
    expect(c).toMatch(/contactCount = selectedCardParam/);
    expect(c).toMatch(/exportHref = selectedCardParam/);
  });
});

describe("a failed invite email is not reported as sent", () => {
  it("the add path reads emailSent", () => {
    const c = code("src/components/office/TeamActions.tsx");
    expect(c).toMatch(/json\.emailSent === false/);
    expect(c).toMatch(/Seat reserved for/);
  });

  it("the remind path reads it too, and offers the link", () => {
    const c = code("src/components/office/TeamActions.tsx");
    expect(c).toMatch(/j\.emailSent === false/);
    expect(c).toMatch(/join\/\$\{j\.inviteToken\}/);
  });

  it("the route still reports it", () => {
    expect(code("src/app/api/office/invite/route.ts")).toMatch(/emailSent/);
  });
});
