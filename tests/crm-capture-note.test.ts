import { describe, it, expect } from "vitest";
import { describeCapture, type CrmLead } from "@/lib/crm-connection";

// The note attached to a Pipedrive person / HighLevel contact is USER-VISIBLE
// text a salesperson reads before calling back, so it gets the same scrutiny as
// any other copy. The risks are empty labels ("Met: "), a note built from
// nothing at all, and losing the field that matters most — which card, and so
// which rep, captured the lead.

const base: CrmLead = { name: "Alex Rivera", email: null, phone: null, company: null };

describe("capture note", () => {
  it("reads as prose, not a data dump", () => {
    const note = describeCapture({
      ...base,
      company: "Northwind Realty",
      whereMet: "Austin Realtor Expo",
      location: "Austin, TX",
      source: "QR code scan",
      capturedByCard: "alex-rivera",
      message: "Looking for office space in Q4",
    });
    expect(note).toContain("Met: Austin Realtor Expo · Austin, TX");
    expect(note).toContain("Captured via: QR code scan");
    // The card line is a clickable URL since 2026-08-26 — anyone reading the
    // CRM record can jump straight to the rep's card.
    expect(note).toContain("Card: https://swiftcard.me/alex-rivera");
    expect(note).toContain("They wrote: Looking for office space in Q4");
    expect(note).toContain("— captured with SwiftCard");
  });

  it("never emits a label with nothing after it", () => {
    // Only a source is known — the common case for a plain card tap. A naive
    // template would still print "Met: " and "Card: " with empty values.
    const note = describeCapture({ ...base, source: "NFC tap" });
    expect(note).toBe("Captured via: NFC tap\n\n— captured with SwiftCard");
    expect(note).not.toMatch(/Met:\s*$/m);
    expect(note).not.toMatch(/Card:\s*$/m);
  });

  it("returns null when there is no context, so no empty note is attached", () => {
    // Without this the CRM gets a note containing only the SwiftCard footer,
    // which is clutter on every single contact.
    expect(describeCapture(base)).toBeNull();
    expect(describeCapture({ ...base, whereMet: "", location: null, source: "" })).toBeNull();
  });

  it("keeps the capturing card, because in an Office that names the rep", () => {
    const note = describeCapture({ ...base, capturedByCard: "jordan-lee" });
    expect(note).toContain("Card: https://swiftcard.me/jordan-lee");
  });
});
