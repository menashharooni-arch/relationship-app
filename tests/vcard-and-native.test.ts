import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildVCard } from "@/lib/vcard";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("one vCard builder, and it escapes everything", () => {
  it("a newline in a lead's phone or email can't inject properties", () => {
    // These are VISITOR-supplied at public capture. The web path escaped name,
    // company and note but passed email and phone through with only .trim().
    const v = buildVCard({
      name: "Sam Fox",
      email: "sam@x.com\r\nTEL:+15550000000",
      phones: [{ number: "+15551234567\r\nEMAIL:evil@x.com", label: "mobile" }],
    });
    const lines = v.split("\r\n");
    // Exactly one of each: the injected text is folded into the VALUE it was
    // smuggled in, never promoted to a property of its own.
    expect(lines.filter((l) => l.startsWith("TEL")).length).toBe(1);
    expect(lines.filter((l) => l.startsWith("EMAIL")).length).toBe(1);
    // The payload must never BEGIN a line — that is what would make it a real
    // property in the contact the owner saves.
    expect(lines.some((l) => l.startsWith("EMAIL:evil"))).toBe(false);
    expect(lines.some((l) => l.startsWith("TEL:+15550000000"))).toBe(false);
    // And every line is a real vCard property.
    for (const l of lines.filter(Boolean)) {
      expect(l, `orphaned line: ${l}`).toMatch(/^[A-Za-z][A-Za-z0-9-]*[;:]/);
    }
  });

  it("carries the note, so both platforms produce the same contact", () => {
    const v = buildVCard({ name: "Sam Fox", note: "Met at: DevCon — follow up re pricing" });
    expect(v).toMatch(/NOTE:Met at: DevCon/);
  });

  it("omits NOTE when there is nothing to say", () => {
    expect(buildVCard({ name: "Sam Fox" })).not.toMatch(/NOTE:/);
    expect(buildVCard({ name: "Sam Fox", note: "   " })).not.toMatch(/NOTE:/);
  });

  it("escapes the note too", () => {
    const v = buildVCard({ name: "Sam Fox", note: "line1\nline2;semi" });
    expect(v).not.toMatch(/NOTE:line1\r?\nline2/);
  });

  it("the contacts screen no longer hand-rolls its own", () => {
    const c = code("src/components/ContactsClient.tsx");
    expect(c, "still building a vCard client-side").not.toMatch(/"BEGIN:VCARD"/);
    expect(c).toMatch(/\/api\/leads\/vcard\?id=/);
  });

  it("the server route supplies the note from the lead", () => {
    const c = code("src/app/api/leads/vcard/route.ts");
    expect(c).toMatch(/where_met, notes/);
    expect(c).toMatch(/note: \[lead\.where_met/);
  });
});

describe("/compare doesn't quote our own price in the native shell", () => {
  it("rows stating SwiftCard's price are flagged", () => {
    const c = code("src/app/compare/page.tsx");
    expect((c.match(/pricing: true/g) ?? []).length).toBe(2);
  });

  it("flagged rows render inside NativeHidden", () => {
    const c = code("src/app/compare/page.tsx");
    expect(c).toMatch(/row\.pricing \? <NativeHidden key=\{row\.label\}>\{tr\}<\/NativeHidden> : tr/);
  });

  it("the prose no longer names a price", () => {
    const c = code("src/app/compare/page.tsx");
    expect(c).not.toMatch(/into one \$4\.99\/mo plan/);
  });

  it("competitor prices are untouched — it's OUR price Apple objects to", () => {
    const c = code("src/app/compare/page.tsx");
    expect(c).toMatch(/\$8\/mo \(Starter\)/);
    expect(c).toMatch(/\$7\.99\/mo \(Pro\)/);
  });
});
