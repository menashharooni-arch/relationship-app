import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCardScope, isCardInScope, isScoped, sanitizeCardScope } from "@/lib/crm-scope";

// Per-card CRM scoping. Integrations are keyed (user_id, provider) and the
// Zapier webhook is one column on profiles, so before this every card on an
// account fed the same destination: connect an employer's GoHighLevel and a
// personal card's contacts were written into it too.
//
// Two things are tested here, and the second matters as much as the first:
//   1. the RULE (pure, exhaustive — including every fail-closed case), and
//   2. that every path data can leave by actually applies it. A correct rule
//      that one egress path skips is not a fix, it is a false sense of one.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const CARD_A = "11111111-1111-4111-8111-111111111111";
const CARD_B = "22222222-2222-4222-8222-222222222222";

describe("the scope rule", () => {
  it("null means ALL cards — the pre-existing behaviour", () => {
    // This is the entire backward-compatibility story: the migration adds the
    // column with no default, so every existing row reads null and nothing
    // about anyone's live integration changed the moment it shipped.
    expect(isCardInScope(null, CARD_A)).toBe(true);
    expect(isCardInScope(null, CARD_B)).toBe(true);
    expect(isScoped(null)).toBe(false);
  });

  it("a list means only those cards", () => {
    expect(isCardInScope([CARD_A], CARD_A)).toBe(true);
    expect(isCardInScope([CARD_A], CARD_B)).toBe(false);
    expect(isCardInScope([CARD_A, CARD_B], CARD_B)).toBe(true);
    expect(isScoped([CARD_A])).toBe(true);
  });

  it("FAILS CLOSED when a scope is set but the card is unknown", () => {
    // The case that matters most. A legacy profile-card has no cards row, so
    // there is no id to check. Sending anyway would be the exact leak this
    // feature exists to stop, and a leak can't be undone — the contact is on
    // someone else's server. A missed sync can.
    expect(isCardInScope([CARD_A], null)).toBe(false);
    expect(isCardInScope([CARD_A], undefined)).toBe(false);
    expect(isCardInScope([CARD_A], "")).toBe(false);
  });

  it("an unknown card is still fine when NOTHING is scoped", () => {
    // Fail-closed must not become fail-always: an account that never touched
    // this feature has to keep syncing even for a card with no row.
    expect(isCardInScope(null, null)).toBe(true);
    expect(isCardInScope(null, undefined)).toBe(true);
  });

  it("an empty list sends nothing", () => {
    expect(isCardInScope([], CARD_A)).toBe(false);
    expect(isCardInScope([], null)).toBe(false);
  });
});

describe("reading a scope out of the database", () => {
  it("treats a MISSING column as all cards, not as a restriction", () => {
    // On a database where the migration hasn't run the field arrives as
    // undefined. Reading that as "restricted" would stop every sync for every
    // account at once — the worst possible failure for a compatibility path.
    expect(parseCardScope(undefined)).toBeNull();
    expect(parseCardScope(null)).toBeNull();
  });

  it("does not let a junk list widen back out to all cards", () => {
    // The user DID restrict this integration. If every entry is unusable the
    // answer is "nothing matches", never "everything matches".
    expect(parseCardScope([])).toEqual([]);
    expect(parseCardScope([123, null, ""])).toEqual([]);
    expect(isCardInScope(parseCardScope([123, null, ""]), CARD_A)).toBe(false);
  });

  it("keeps the usable ids out of a mixed list", () => {
    expect(parseCardScope([CARD_A, 42, null, CARD_B])).toEqual([CARD_A, CARD_B]);
  });
});

describe("sanitizing a scope on its way in", () => {
  it("null stays null (all cards)", () => {
    expect(sanitizeCardScope(null)).toBeNull();
    expect(sanitizeCardScope(undefined)).toBeNull();
  });

  it("drops anything that isn't a uuid", () => {
    // These are written into a uuid[] column — a non-uuid would make Postgres
    // reject the whole update rather than just that entry.
    expect(sanitizeCardScope([CARD_A, "not-a-uuid", "", 7, null])).toEqual([CARD_A]);
  });

  it("de-duplicates and normalizes case", () => {
    expect(sanitizeCardScope([CARD_A, CARD_A.toUpperCase()])).toEqual([CARD_A]);
  });
});

// ── The half that keeps the rule honest ──────────────────────────────────────
// There are exactly three ways contact data leaves for a CRM destination. Each
// one is pinned here; adding a fourth without a gate should fail this file.
describe("every egress path applies the rule", () => {
  it("the CRM gate lives in getCrmConnection, so no provider can skip it", () => {
    // All four syncs must come through this function for a token, which is why
    // the check sits here rather than being repeated (and eventually forgotten)
    // per provider.
    const src = stripComments(read("src/lib/crm-connection.ts"));
    expect(src, "getCrmConnection no longer reads the scope column").toMatch(/card_ids/);
    expect(src, "getCrmConnection no longer checks the scope").toMatch(/isCardInScope\(/);
    // Required, not optional: the compiler is what stops a fifth provider from
    // being added with the argument missing.
    expect(src).toMatch(/cardId:\s*string \| null \| undefined,/);
  });

  it.each([
    ["src/lib/sync-google.ts", "google"],
    ["src/lib/sync-hubspot.ts", "hubspot"],
    ["src/lib/sync-pipedrive.ts", "pipedrive"],
    ["src/lib/sync-highlevel.ts", "highlevel"],
  ])("%s passes the capturing card into the gate", (file) => {
    const src = stripComments(read(file));
    expect(src, `${file} calls getCrmConnection without the card id`).toMatch(
      /getCrmConnection\([^)]*lead\.capturedByCardId/s,
    );
  });

  it("the lead route feeds the real card id in, and gates its Zapier webhook", () => {
    const src = stripComments(read("src/app/api/leads/route.ts"));
    // Fed from the cards row, NOT from card_owner — that one is the slug, which
    // the owner can rename out from under a scope.
    expect(src, "the lead route stopped passing the capturing card's id").toMatch(
      /capturedByCardId:\s*\(cardRow\?\.id/,
    );
    expect(src, "the Zapier lead webhook is no longer scope-gated").toMatch(/isCardInScope\(parseCardScope\(ownerProfile\.zapier_card_ids\)/);
  });

  it("card view / notification events are gated too", () => {
    // Views and notifications describe one card's activity, so a webhook
    // pointed at one card's workflow must not receive another card's traffic.
    const src = stripComments(read("src/lib/crm-events.ts"));
    expect(src, "dispatchCrmEvent no longer reads the scope").toMatch(/zapier_card_ids/);
    expect(src, "dispatchCrmEvent no longer checks the scope").toMatch(/isCardInScope\(/);
    // It has to select the card id to have something to check.
    expect(src).toMatch(/from\("cards"\)\s*\.select\("id, user_id"\)/);
  });
});

describe("the save API can't be used to create a silent trap", () => {
  const src = stripComments(read("src/app/api/settings/crm-scope/route.ts"));

  it("refuses an empty selection", () => {
    // An empty list means "send nothing" — a destination that still says
    // Connected and quietly never fires. Better to make the user say so.
    expect(src).toMatch(/empty_scope/);
    expect(src).toMatch(/scope\.length === 0/);
  });

  it("only accepts cards the caller actually owns", () => {
    expect(src).toMatch(/from\("cards"\)\.select\("id"\)\.eq\("user_id", user\.id\)/);
    expect(src).toMatch(/unknown_card/);
  });

  it("requires a real connection, which is what keeps a sub-user off the office CRM", () => {
    // An Office sub-user inheriting the owner's CRM has no integrations row of
    // their own, so there is nothing to update and they cannot re-scope
    // company property.
    expect(src).toMatch(/not_connected/);
    expect(src).toMatch(/\.eq\("user_id", user\.id\)\s*\.eq\("provider", target\)/);
  });

  it("is Pro-gated like the integrations themselves", () => {
    expect(src).toMatch(/isPaidPlan/);
  });
});
