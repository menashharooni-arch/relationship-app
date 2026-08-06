import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Two places where the product told the user one thing and did another. Both
// are irreversible, so the copy IS the safety mechanism — a person reads the
// sentence, believes it, and clicks.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
// Strip comments before asserting on copy: these files now explain the old
// wording in comments, and a naive search would match the explanation.
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("delete-card dialog tells the truth about contacts", () => {
  const DIALOG = "src/components/ManageCards.tsx";
  const API = "src/app/api/cards/[id]/route.ts";

  it("the API really does purge the card's leads — the premise of this test", () => {
    // If this ever stops being true, the dialog copy below becomes wrong in the
    // other direction and must be revisited.
    expect(code(API)).toMatch(/from\("leads"\)\s*\.delete\(\)\s*\.eq\("card_owner", username\)/);
  });

  it("no longer claims captured contacts are kept", () => {
    expect(code(DIALOG), "the dialog still promises contacts survive the delete").not.toMatch(
      /Contacts already captured by this card are kept/i,
    );
    expect(code(DIALOG)).not.toMatch(/contacts[^.]{0,40}are kept/i);
  });

  it("states the contact deletion and points at the export", () => {
    const c = code(DIALOG);
    expect(c).toMatch(/permanently deletes every contact/i);
    expect(c, "no route offered to save the contacts first").toMatch(/export/i);
  });
});

describe("removing an office member leaves a way back", () => {
  const MEMBERS = "src/app/api/office/members/route.ts";
  const CARD_API = "src/app/api/cards/[id]/route.ts";
  const DIALOG = "src/components/office/TeamActions.tsx";

  it("takes only OFFICE cards offline, never a card outside the office", () => {
    const c = code(MEMBERS);
    expect(
      c,
      "the offline flip is unscoped again — it reaches cards the office never owned",
    ).toMatch(/update\(\{ is_offline: true \}\)[\s\S]{0,120}?\.eq\("is_office_card", true\)/);
  });

  it("unflags the cards on the way out, which is what hands them back", () => {
    // Joining flags every card the member owns; nothing used to ever clear it,
    // so the card stayed office property forever and the owner-side restore
    // below would refuse it.
    expect(code(MEMBERS)).toMatch(/is_office_card: false/);
  });

  it("the owner can turn a card of their own back on", () => {
    const c = code(CARD_API);
    expect(c).toMatch(/body\.is_offline === false/);
    expect(c).toMatch(/update\(\{ is_offline: false \}\)/);
  });

  it("but NOT while it is still an office card — an admin can't be overridden", () => {
    expect(
      code(CARD_API),
      "an active employee could undo their Office admin's take-offline",
    ).toMatch(/is_office_card === true[\s\S]{0,300}?status: 403/);
  });

  it("only ever turns a card ON through that path — never off", () => {
    // Accepting `true` here would hand every caller a kill switch that the
    // office admin is supposed to own.
    expect(code(CARD_API)).not.toMatch(/is_offline: true/);
  });

  it("the removal dialog no longer promises a single card, and says how to recover", () => {
    const c = code(DIALOG);
    expect(c, "still singular — removal affects every company card they hold").not.toMatch(
      /s\s*card will be turned off/,
    );
    expect(c).toMatch(/cards will be turned off/);
    expect(c).toMatch(/back online/i);
  });
});
