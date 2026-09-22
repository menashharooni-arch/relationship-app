import { describe, it, expect, vi, beforeEach } from "vitest";

// ── A new office starts with the owner's WHOLE card as its brand ─────────────
//
// Owner, 2026-09-22: "when an admin designs their card in SwiftLinks, then they
// create an account ... I want it to be the exact design for the card, links,
// and branding ... company name, website, business address, or office phone
// number, if it's already there, should already be in there. Why would someone
// design their card in SwiftLinks and then have to go back into branding and do
// that also?"
//
// The seed used to copy the logo, company, website, template and card colours,
// and leave Branding's phone, fax, address and the whole Links tab blank.

type Row = Record<string, unknown>;
const db: { office: Row; card: Row | null; updates: Row[] } = { office: {}, card: null, updates: [] };

function table(name: string) {
  const q: Record<string, unknown> = {};
  const chain = () => q;
  Object.assign(q, {
    select: chain, eq: chain, order: chain, limit: chain, in: chain, neq: chain,
    maybeSingle: async () => ({ data: name === "offices" ? db.office : name === "cards" ? db.card : null, error: null }),
    update: (u: Row) => {
      if (name === "offices") db.updates.push(u);
      return { eq: async () => ({ error: null }) };
    },
    then: (res: (v: unknown) => void) => res({ data: [], error: null }),
  });
  return q;
}

vi.mock("@/lib/supabase-admin", () => ({ getAdminSupabase: () => ({ from: table }) }));

const { seedBrandFromOwnersFirstCard } = await import("@/lib/office-brand");

beforeEach(() => {
  db.office = { brand_logo_url: null, brand_company: null, brand_website: null, brand_template: null, brand_design: null };
  db.updates = [];
});

const CARD = {
  id: "c1",
  logo_url: "https://x.supabase.co/storage/v1/object/public/cards/logo.png",
  company: "Coastline Realty",
  website: "coastlinehomes.com",
  template: "classic-pro",
  customization: {
    phones: [
      { number: "(555) 222-3333", label: "mobile", showOnCard: true },
      { number: "(555) 123-4567", label: "office", showOnCard: true },
    ],
    fax: "(555) 123-4568",
    address: { street: "12 Harbor Way", unit: "", city: "Newport", state: "RI", zip: "02840" },
    accentColor: "#b08d57",
    linkLook: "linen",
    bio: "Her own bio",
    links: [{ label: "My listings", url: "https://example.com" }],
  },
};

describe("seedBrandFromOwnersFirstCard takes the whole card", () => {
  it("company details, the office phone, fax, address, card look and Links look", async () => {
    db.card = CARD;
    await seedBrandFromOwnersFirstCard("o1", "u1");
    const u = db.updates[0];
    expect(u.brand_company).toBe("Coastline Realty");
    expect(u.brand_website).toBe("coastlinehomes.com");
    expect(u.brand_logo_url).toBe(CARD.logo_url);
    expect(u.brand_phone).toBe("(555) 123-4567");
    expect(u.brand_fax).toBe("(555) 123-4568");
    expect(u.brand_address).toEqual({ street: "12 Harbor Way", city: "Newport", state: "RI", zip: "02840" });
    expect((u.brand_design as Row).accentColor).toBe("#b08d57");
    expect((u.brand_link_design as Row).linkLook).toBe("linen");
  });

  it("a mobile number is personal — never the team's office phone", async () => {
    db.card = { ...CARD, customization: { ...CARD.customization, phones: [{ number: "(555) 222-3333", label: "mobile", showOnCard: true }] } };
    await seedBrandFromOwnersFirstCard("o1", "u1");
    expect(db.updates[0].brand_phone).toBeNull();
  });

  it("the Links page CONTENT stays the owner's — design only", async () => {
    db.card = CARD;
    await seedBrandFromOwnersFirstCard("o1", "u1");
    const ld = db.updates[0].brand_link_design as Row;
    expect(ld.bio).toBeUndefined();
    expect(ld.links).toBeUndefined();
    expect(db.updates[0].brand_link_bio).toBeUndefined();
    expect(db.updates[0].brand_links).toBeUndefined();
  });

  it("never overwrites a brand the admin already set", async () => {
    db.card = CARD;
    db.office = { ...db.office, brand_company: "Already Set" };
    await seedBrandFromOwnersFirstCard("o1", "u1");
    expect(db.updates).toHaveLength(0);
  });
});
