import { describe, it, expect } from "vitest";
import { getSourceLabel, getSignupSourceLabel } from "@/lib/source-labels";

describe("getSourceLabel", () => {
  it("maps known contact sources to friendly labels", () => {
    expect(getSourceLabel("qr_code")).toBe("QR code scan");
    expect(getSourceLabel("nfc_card")).toBe("NFC tap");
    expect(getSourceLabel("direct_link")).toBe("Card link");
  });

  it("falls back to 'Not tracked' for null/undefined", () => {
    expect(getSourceLabel(null)).toBe("Not tracked");
    expect(getSourceLabel(undefined)).toBe("Not tracked");
  });

  it("humanizes an unknown source instead of showing raw snake_case", () => {
    expect(getSourceLabel("some_new_source")).toBe("some new source");
  });
});

describe("getSignupSourceLabel", () => {
  it("defaults an empty source to the organic label", () => {
    expect(getSignupSourceLabel(null)).toContain("Organic");
    expect(getSignupSourceLabel(undefined)).toContain("Organic");
  });

  it("maps a known signup source", () => {
    expect(getSignupSourceLabel("referral")).toContain("Referral");
  });
});
