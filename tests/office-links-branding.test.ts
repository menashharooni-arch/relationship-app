import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pinOfficeLinks } from "@/lib/office-brand";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// ── The office's link buttons are ADDITIVE ──────────────────────────────────
//
// An earlier version of this was an all-or-nothing freeze: "only you can add
// link buttons", and a member could touch nothing. That was the wrong shape.
// An office wants its booking link on every page — not to stop a salesperson
// linking their own calendar. So the office PINS links, they lead the list and
// cannot be edited or removed by the member, and everything the member adds
// follows and stays theirs.

const OFFICE = [
  { label: "Book a meeting", url: "https://northwind.com/book" },
  { label: "Our listings", url: "https://northwind.com/listings" },
];
const brand = { links: OFFICE };

describe("pinOfficeLinks", () => {
  it("puts the office's links first and keeps the member's after", () => {
    const out = pinOfficeLinks([{ label: "My calendar", url: "https://cal.com/sam" }], brand) as { label: string; url: string }[];
    expect(out.map((l) => l.url)).toEqual([
      "https://northwind.com/book",
      "https://northwind.com/listings",
      "https://cal.com/sam",
    ]);
  });

  it("re-pins a link the member deleted", () => {
    // Their payload simply omits it; the office's own record puts it back.
    const out = pinOfficeLinks([{ label: "My calendar", url: "https://cal.com/sam" }], brand) as { url: string }[];
    expect(out.some((l) => l.url === "https://northwind.com/book")).toBe(true);
  });

  it("cannot be claimed by renaming it", () => {
    // Identity is the URL. Matching on label would let a member rename an
    // office link into "theirs" — and then remove it.
    const out = pinOfficeLinks([{ label: "Sam's own booking page", url: "https://northwind.com/book" }], brand) as { label: string }[];
    expect(out.filter((l) => l.label === "Sam's own booking page")).toHaveLength(0);
    expect(out[0].label).toBe("Book a meeting");
  });

  it("does not duplicate on a trailing slash or different case", () => {
    const out = pinOfficeLinks([{ label: "dupe", url: "https://Northwind.com/book/" }], brand) as unknown[];
    expect(out).toHaveLength(2);
  });

  it("never reorders the office's links, whatever order they arrive in", () => {
    const out = pinOfficeLinks(
      [{ label: "x", url: "https://northwind.com/listings" }, { label: "y", url: "https://northwind.com/book" }],
      brand,
    ) as { url: string }[];
    expect(out.map((l) => l.url)).toEqual(["https://northwind.com/book", "https://northwind.com/listings"]);
  });

  it("leaves a member alone when the office has pinned nothing", () => {
    const own = [{ label: "Mine", url: "https://mine.example" }];
    expect(pinOfficeLinks(own, { links: null })).toBe(own);
    expect(pinOfficeLinks(own, null)).toBe(own);
  });

  it("survives junk without throwing", () => {
    for (const junk of [null, undefined, "nope", 42, [null], [{}]]) {
      expect(() => pinOfficeLinks(junk, brand)).not.toThrow();
    }
    expect((pinOfficeLinks(null, brand) as unknown[]).length).toBe(2);
  });

  it("never mutates what it was given", () => {
    const own = [{ label: "Mine", url: "https://mine.example" }];
    const before = JSON.stringify(own);
    pinOfficeLinks(own, brand);
    expect(JSON.stringify(own)).toBe(before);
    // And the returned office entries are copies, so a caller cannot edit the
    // brand through them.
    const out = pinOfficeLinks(own, brand) as { label: string }[];
    out[0].label = "tampered";
    expect(OFFICE[0].label).toBe("Book a meeting");
  });
});

describe("the server pins them — the UI is not the boundary", () => {
  it("on save, sub-users only", () => {
    const route = read("src/app/api/cards/[id]/route.ts");
    expect(route).toMatch(/if \(subCtx && brand && updates\.customization\)/);
    expect(route).toMatch(/overlayOfficeLinks\(updates\.customization as Record<string, unknown>, brand\)/);
  });

  it("on a new member card too", () => {
    const route = read("src/app/api/cards/route.ts");
    expect(route).toMatch(/if \(subCtx\) cust = overlayOfficeLinks\(/);
  });

  it("forces the office Instagram as a TOP-LEVEL column, not a customization key", () => {
    // cards.instagram is a real column. Writing customization.instagram would
    // have created a second copy that the links page never reads.
    expect(read("src/app/api/cards/[id]/route.ts")).toMatch(/updates\.instagram = brand\.linkInstagram/);
    expect(read("src/app/api/cards/route.ts")).toMatch(/subCtx && brand\?\.linkInstagram\) \|\| instagram/);
    const lib = read("src/lib/office-brand.ts");
    const fn = lib.slice(lib.indexOf("export function overlayOfficeLinks"), lib.indexOf("// ── Pure overlay: apply the company-controlled contact"));
    expect(fn, "the overlay is writing a customization.instagram copy").not.toMatch(/cust\.instagram =/);
  });

  it("no longer freezes a member's whole list", () => {
    // The old behaviour. A member must be able to add and remove their OWN
    // links while the office's stay put.
    for (const p of ["src/app/api/cards/[id]/route.ts", "src/app/api/cards/route.ts"]) {
      expect(read(p), `${p} still carries the old all-or-nothing lock`).not.toContain("lockLinks");
    }
  });
});

describe("the member can tell which links are theirs", () => {
  const form = read("src/app/cards/[id]/edit/CardEditForm.tsx");

  it("marks the office's links and gives them no remove control", () => {
    // A remove button the server undoes on save is worse than no button.
    expect(form).toContain("isOfficeLink(l.url)");
    expect(form).toMatch(/Company<\/span>/);
  });

  it("keeps the member's own links fully editable", () => {
    expect(form).toMatch(/\) : \(\s*<button type="button" onClick=\{\(\) => removeLink\(i\)\}/);
  });

  it("still offers the add form to everyone", () => {
    // Members add on top; that is the whole point of the additive rule.
    expect(form).not.toMatch(/turned off link buttons on team cards/);
  });
});

describe("the Swift Links DESIGN lock is separate from the links", () => {
  it("defaults off and reads from brand_locks.linkDesign", () => {
    const brandLib = read("src/lib/office-brand.ts");
    expect(brandLib).toMatch(/lockLinkDesign: locks\?\.linkDesign === true/);
    expect(brandLib).not.toMatch(/locks\?\.linkDesign !== false/);
  });

  it("replaces the whole design panel rather than showing dead controls", () => {
    for (const p of ["src/app/cards/[id]/edit/CardEditForm.tsx", "src/app/cards/new/NewCardWizard.tsx"]) {
      const src = read(p);
      expect(src, `${p} does not gate the design panel`).toMatch(/\{linkDesignLocked \? \(/);
      // And the per-link controls come back for everyone else.
      expect(src).toMatch(/links=\{links\}/);
      expect(src).toMatch(/onLinksChange=\{setLinks\}/);
    }
  });

  it("says what is still the member's", () => {
    const form = read("src/app/cards/[id]/edit/CardEditForm.tsx");
    expect(form).toMatch(/Your bio, your socials\s*\n?\s*and your own link buttons are still yours/);
  });
});
