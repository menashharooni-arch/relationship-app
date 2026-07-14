import { describe, it, expect } from "vitest";
import { overlayOfficeContact, stripOfficeContact } from "@/lib/office-brand";

const brand = { phone: "(555) 111-2222", fax: "(555) 111-3333", address: { street: "1 Main St", city: "NYC", state: "NY", zip: "10001" } };

describe("overlayOfficeContact — company contact is uniform + preserves personal fields", () => {
  it("injects the office phone as the first, labeled entry and keeps personal phones", () => {
    const cust = { phones: [{ number: "(555) 999-0000", label: "Mobile", showOnCard: true }], bio: "hi" };
    const out = overlayOfficeContact(cust, brand);
    const phones = out.phones as Array<{ number: string; label: string; office?: boolean }>;
    expect(phones[0]).toMatchObject({ number: "(555) 111-2222", label: "Office", office: true });
    expect(phones[1]).toMatchObject({ number: "(555) 999-0000", label: "Mobile" }); // personal preserved
    expect(out.bio).toBe("hi"); // other fields untouched
  });

  it("sets company fax + address", () => {
    const out = overlayOfficeContact({}, brand);
    expect(out.fax).toBe("(555) 111-3333");
    expect(out.address).toEqual(brand.address);
  });

  it("replaces a stale office phone entry instead of duplicating it", () => {
    const cust = { phones: [{ number: "OLD", label: "Office", showOnCard: true, office: true }, { number: "personal", showOnCard: true }] };
    const out = overlayOfficeContact(cust, brand);
    const phones = out.phones as Array<{ number: string; office?: boolean }>;
    expect(phones.filter((p) => p.office).length).toBe(1);
    expect(phones[0].number).toBe("(555) 111-2222");
    expect(phones.some((p) => p.number === "personal")).toBe(true);
  });

  it("no office phone → strips any office entry, leaves personal phones", () => {
    const cust = { phones: [{ number: "OLD", label: "Office", office: true }, { number: "personal" }] };
    const out = overlayOfficeContact(cust, { phone: null, fax: null, address: null });
    const phones = out.phones as Array<{ number: string; office?: boolean }>;
    expect(phones.some((p) => p.office)).toBe(false);
    expect(phones).toHaveLength(1);
  });
});

describe("stripOfficeContact — removes company contact on leave, keeps personal", () => {
  it("removes the office phone entry, keeps personal phones", () => {
    const cust = { phones: [{ number: "(555) 111-2222", label: "Office", office: true }, { number: "personal", showOnCard: true }] };
    const out = stripOfficeContact(cust, brand);
    const phones = out.phones as Array<{ number: string; office?: boolean }>;
    expect(phones.some((p) => p.office)).toBe(false);
    expect(phones.some((p) => p.number === "personal")).toBe(true);
  });

  it("clears fax/address only when they still match the office values", () => {
    const matching = stripOfficeContact({ fax: "(555) 111-3333", address: brand.address }, brand);
    expect(matching.fax).toBe("");
    expect(matching.address).toBeUndefined();

    const personal = stripOfficeContact({ fax: "MY OWN FAX", address: { street: "personal" } }, brand);
    expect(personal.fax).toBe("MY OWN FAX"); // a personal value is never wiped
    expect(personal.address).toEqual({ street: "personal" });
  });
});
