import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { corroboratedContact } from "@/lib/viewer-identity";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// A fake service-role client: `leads` returns whatever the test plants.
function fakeAdmin(row: Record<string, unknown> | null, onQuery?: (q: Record<string, unknown>) => void) {
  const q: Record<string, unknown> = {};
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (col: string, val: unknown) => { q[col] = val; return chain; },
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => { onQuery?.(q); return { data: row }; },
  };
  return { from: () => chain } as never;
}

const ATTACKER = {
  visitor_name: "Acme CFO",
  visitor_email: "attacker@evil.com",
  visitor_phone: "+15551234567",
};

describe("a stranger cannot write a fabricated contact into someone's CRM", () => {
  it("sends NO contact details when the visitor never shared anything with this owner", async () => {
    // The attack: POST /api/card-events with a public card slug and any
    // name/email/phone. Card slugs are public and enumerable, and the endpoint
    // is unauthenticated by design.
    const contact = await corroboratedContact({
      admin: fakeAdmin(null),
      cardOwner: "victim-slug",
      visitorId: "attacker-chosen-id",
      sessionViewer: null,
      identity: ATTACKER,
    });
    expect(contact, "forged details reached the CRM payload").toBeNull();
  });

  it("uses the LEAD's stored values, never the ones on the request", async () => {
    // A real visitor who shared their details is recognised on a later visit —
    // that feature survives. But the values come from the row they submitted.
    const contact = await corroboratedContact({
      admin: fakeAdmin({ name: "Dana Real", email: "dana@real.com", phone: "+15550000000" }),
      cardOwner: "owner-slug",
      visitorId: "dana-browser",
      // Even when the request carries something different — a tampered client,
      // or a stale localStorage blob from another account.
      sessionViewer: null,
      identity: ATTACKER,
    });
    expect(contact).toEqual({ name: "Dana Real", email: "dana@real.com", phone: "+15550000000" });
    expect(JSON.stringify(contact)).not.toContain("evil.com");
  });

  it("looks the lead up by visitor_id, never by the attacker-controlled email", async () => {
    // Looking up the vouching record BY the field being vouched for proves
    // nothing — it would confirm any email that had ever been used anywhere.
    let seen: Record<string, unknown> = {};
    await corroboratedContact({
      admin: fakeAdmin(null, (q) => { seen = q; }),
      cardOwner: "owner-slug",
      visitorId: "some-browser",
      sessionViewer: null,
      identity: ATTACKER,
    });
    expect(seen.card_owner).toBe("owner-slug");
    expect(seen.visitor_id).toBe("some-browser");
    expect(Object.values(seen)).not.toContain("attacker@evil.com");
  });

  it("scopes to THIS owner — a lead shared with someone else does not vouch", async () => {
    let seen: Record<string, unknown> = {};
    await corroboratedContact({
      admin: fakeAdmin(null, (q) => { seen = q; }),
      cardOwner: "owner-a",
      visitorId: "v1",
      sessionViewer: null,
      identity: ATTACKER,
    });
    expect(seen.card_owner).toBe("owner-a");
  });

  it("passes an authenticated viewer straight through — a session is proof", async () => {
    const contact = await corroboratedContact({
      admin: fakeAdmin(null),
      cardOwner: "owner-slug",
      visitorId: "whatever",
      sessionViewer: { userId: "u1", name: "Signed In Sam", email: "sam@x.com" },
      // authoritativeEventIdentity has already reduced this to the session name
      // with no email or phone; that reduction is what gets forwarded.
      identity: { visitor_name: "Signed In Sam", visitor_email: null, visitor_phone: null },
    });
    expect(contact).toEqual({ name: "Signed In Sam", email: null, phone: null });
  });

  it("never throws — a database hiccup means no contact details, not a broken visit", async () => {
    const exploding = { from: () => { throw new Error("db down"); } } as never;
    await expect(
      corroboratedContact({ admin: exploding, cardOwner: "o", visitorId: "v", sessionViewer: null, identity: ATTACKER }),
    ).resolves.toBeNull();
  });

  it("has no visitor_id to trust when the request omits one", async () => {
    const contact = await corroboratedContact({
      admin: fakeAdmin({ name: "Someone", email: "a@b.c", phone: null }),
      cardOwner: "owner-slug",
      visitorId: null,
      sessionViewer: null,
      identity: ATTACKER,
    });
    expect(contact).toBeNull();
  });
});

describe("the route actually uses it", () => {
  const route = read("src/app/api/card-events/route.ts");

  it("no longer hands the client-supplied identity to the CRM", () => {
    const dispatch = route.slice(route.indexOf("await dispatchCrmEvent("), route.indexOf("await dispatchCrmEvent(") + 700);
    expect(dispatch).toContain("crmContact");
    expect(
      /contact:\s*\{\s*name:\s*identity\./.test(dispatch),
      "the raw client identity is still being posted to the CRM",
    ).toBe(false);
  });

  it("omits the contact key entirely rather than sending empty fields", () => {
    // A contact of {name:null,email:null,phone:null} would still create a blank
    // record in some pipelines. Absent is cleaner than empty.
    expect(route).toContain("...(crmContact ? { contact: crmContact } : {})");
  });

  it("still records our own bell identity separately", () => {
    // The bell keeps the client-supplied association on purpose — it says how
    // sure it is via identityLevel and never claims certainty. Only the CRM,
    // a customer's system of record, demands corroboration.
    expect(route).toContain("identityLevel");
    expect(route).toContain("authoritativeEventIdentity");
  });
});
