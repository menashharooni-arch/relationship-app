import { describe, it, expect } from "vitest";
import { buildVCard, escapeVCardValue, normalizeVCardUrl } from "@/lib/vcard";

// A tiny 1x1 JPEG's base64 stand-in is enough to exercise the PHOTO path — the
// builder never decodes it, it only base64-frames + folds.
const SAMPLE_B64 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcU";

describe("escapeVCardValue", () => {
  it("escapes the vCard-significant characters", () => {
    expect(escapeVCardValue("Smith, John; Jr.\\")).toBe("Smith\\, John\\; Jr.\\\\");
  });
  it("collapses newlines so a value can't inject a fake field", () => {
    expect(escapeVCardValue("A\r\nTEL:911")).toBe("A TEL:911");
  });
  it("coerces null/undefined to empty string", () => {
    expect(escapeVCardValue(null)).toBe("");
    expect(escapeVCardValue(undefined)).toBe("");
  });
});

describe("normalizeVCardUrl", () => {
  it("leaves absolute URLs alone and prefixes bare domains", () => {
    expect(normalizeVCardUrl("https://swiftcard.me")).toBe("https://swiftcard.me");
    expect(normalizeVCardUrl("swiftcard.me")).toBe("https://swiftcard.me");
    expect(normalizeVCardUrl("")).toBe("");
  });
});

describe("buildVCard — structure", () => {
  it("always emits the required envelope + FN/N", () => {
    const out = buildVCard({ name: "Alex Morgan" });
    expect(out.startsWith("BEGIN:VCARD\r\nVERSION:3.0")).toBe(true);
    expect(out.trimEnd().endsWith("END:VCARD")).toBe(true);
    expect(out).toContain("FN:Alex Morgan");
    expect(out).toContain("N:Morgan;Alex;;;");
  });

  it("uses CRLF line endings", () => {
    const out = buildVCard({ name: "Alex Morgan", email: "a@b.com" });
    expect(out).toContain("\r\n");
    expect(out).not.toMatch(/[^\r]\n/); // every LF is preceded by CR
  });

  it("includes typed phones, fax, address and socials when present", () => {
    const out = buildVCard({
      name: "Alex Morgan",
      title: "CEO",
      company: "Morgan & Co.",
      email: "alex@x.com",
      phones: [
        { number: "555-1111", label: "mobile" },
        { number: "555-2222", label: "office" },
      ],
      fax: "555-3333",
      website: "morgan.com",
      address: { street: "1 Main", unit: "5", city: "NYC", state: "NY", zip: "10001" },
      linkedin: "linkedin.com/in/alex",
      instagram: "@alex",
    });
    expect(out).toContain("TITLE:CEO");
    expect(out).toContain("ORG:Morgan & Co.");
    expect(out).toContain("EMAIL;TYPE=WORK:alex@x.com");
    expect(out).toContain("TEL;TYPE=CELL,VOICE:555-1111");
    expect(out).toContain("TEL;TYPE=WORK,VOICE:555-2222");
    expect(out).toContain("TEL;TYPE=FAX:555-3333");
    expect(out).toContain("URL:https://morgan.com");
    expect(out).toContain("ADR;TYPE=WORK:;;1 Main Unit 5;NYC;NY;10001;");
    expect(out).toContain("URL;type=LinkedIn:https://linkedin.com/in/alex");
    expect(out).toContain("X-SOCIALPROFILE;type=instagram:alex"); // leading @ stripped
  });

  it("falls back to the legacy single phone when no phones[] given", () => {
    const out = buildVCard({ name: "A B", phone: "555-9999" });
    expect(out).toContain("TEL:555-9999");
  });

  it("omits every optional field that is empty", () => {
    const out = buildVCard({ name: "Solo" });
    expect(out).not.toContain("TITLE:");
    expect(out).not.toContain("ORG:");
    expect(out).not.toContain("EMAIL");
    expect(out).not.toContain("TEL");
    expect(out).not.toContain("ADR");
    expect(out).not.toContain("PHOTO");
  });

  it("neutralizes an injection attempt in a visitor-supplied name", () => {
    const out = buildVCard({ name: "Eve\r\nTEL:911" });
    expect(out).toContain("FN:Eve TEL:911");
    expect(out).not.toMatch(/\r\nTEL:911\r\n/);
  });
});

describe("buildVCard — embedded PHOTO", () => {
  it("adds a folded vCard-3.0 PHOTO line from raw base64", () => {
    const out = buildVCard({ name: "Alex Morgan" }, { base64: SAMPLE_B64, mime: "image/jpeg" });
    expect(out).toContain("PHOTO;ENCODING=b;TYPE=JPEG:");
    // Continuation lines of a folded property start with a single space.
    const lines = out.split("\r\n");
    const photoIdx = lines.findIndex((l) => l.startsWith("PHOTO;"));
    expect(photoIdx).toBeGreaterThan(-1);
    // No source line should exceed 75 octets.
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(75);
  });

  it("accepts a full data: URL and infers PNG type", () => {
    const out = buildVCard({ name: "A B" }, { base64: `data:image/png;base64,${SAMPLE_B64}` });
    expect(out).toContain("PHOTO;ENCODING=b;TYPE=PNG:");
  });

  it("omits PHOTO (and never throws) when the image is missing/garbage", () => {
    expect(buildVCard({ name: "A B" }, null)).not.toContain("PHOTO");
    expect(buildVCard({ name: "A B" }, { base64: "" })).not.toContain("PHOTO");
    expect(buildVCard({ name: "A B" }, { base64: "not base64 !!!" })).not.toContain("PHOTO");
  });

  it("saving a contact never breaks over a photo — the card is still valid", () => {
    const out = buildVCard({ name: "A B", email: "a@b.com" }, { base64: "%%%invalid%%%" });
    expect(out).toContain("BEGIN:VCARD");
    expect(out.trimEnd().endsWith("END:VCARD")).toBe(true);
    expect(out).toContain("EMAIL;TYPE=WORK:a@b.com");
  });
});
