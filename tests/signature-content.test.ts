import { describe, it, expect } from "vitest";
import { signatureContentSig, cardImageData } from "../src/lib/signature-content";
import type { CardData } from "../src/components/card-templates/types";

// The owner's rule (2026-08-18): the "you've changed your card design — re-copy
// your signature" prompt appears ONLY when card design or card info changed.
// Swift Links page edits (bio, link buttons, Looks and their fine-tuning) do
// not appear on the card image, so they must not move the signature hash.

const base: CardData = {
  name: "Sam Okafor",
  title: "Real Estate Agent",
  company: "Harbor & Oak Realty",
  phone: "(415) 555-0137",
  email: "sam@example.com",
  website: "https://example.com",
  customization: {
    accentColor: "#1D4ED8",
    bio: "Helping first-time buyers.",
    links: [{ emoji: "", label: "Listings", url: "https://example.com/l" }],
    linkLook: "paper",
    linkIconShape: "squircle",
  },
} as unknown as CardData;

const sig = (d: CardData) => signatureContentSig(d, "classic-pro", "https://swiftcard.me/card/sam");

describe("signature content hash ignores Swift Links page edits", () => {
  it.each([
    ["bio", { bio: "A totally different bio" }],
    ["links", { links: [{ emoji: "", label: "New", url: "https://x.com" }] }],
    ["about", { about: "Long about section" }],
    ["linkLook", { linkLook: "aura" }],
    ["linkBgColor", { linkBgColor: "#000000" }],
    ["linkTextColor", { linkTextColor: "#FFFFFF" }],
    ["linkFontFamily", { linkFontFamily: "serif" }],
    ["linkIconShape", { linkIconShape: "square" }],
    ["linkIconFill", { linkIconFill: "mono" }],
  ])("%s changes do not move the hash", (_k, patch) => {
    const edited = { ...base, customization: { ...base.customization, ...patch } } as CardData;
    expect(sig(edited)).toBe(sig(base));
  });

  it.each([
    ["name", { name: "Someone Else" }],
    ["title", { title: "Broker" }],
    ["company", { company: "New Co" }],
    ["phone", { phone: "(212) 555-0100" }],
  ])("card info change (%s) moves the hash", (_k, patch) => {
    const edited = { ...base, ...patch } as CardData;
    expect(sig(edited)).not.toBe(sig(base));
  });

  it("card design change (accent color) moves the hash", () => {
    const edited = { ...base, customization: { ...base.customization, accentColor: "#DC2626" } } as CardData;
    expect(sig(edited)).not.toBe(sig(base));
  });

  it("template and card URL are part of the hash", () => {
    expect(signatureContentSig(base, "modern-bold", "https://swiftcard.me/card/sam")).not.toBe(sig(base));
    expect(signatureContentSig(base, "classic-pro", "https://swiftcard.me/card/other")).not.toBe(sig(base));
  });

  it("cardImageData strips page-only keys and keeps card keys", () => {
    const d = cardImageData(base);
    const c = d.customization as Record<string, unknown>;
    expect(c.bio).toBeUndefined();
    expect(c.links).toBeUndefined();
    expect(c.linkLook).toBeUndefined();
    expect(c.accentColor).toBe("#1D4ED8");
  });
});
