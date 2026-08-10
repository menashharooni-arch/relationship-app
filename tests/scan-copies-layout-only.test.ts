import { describe, it, expect } from "vitest";
import { SCAN_PROMPT, layoutFromScan, zoneFor } from "@/lib/custom-layout";

// The "copy a card or template you like" feature.
//
// Two promises are made to the owner in the UI, and this file is where they are
// kept honest:
//
//   1. It copies the LAYOUT — where the logo sits, where the headshot sits, the
//      order and weight of the text — from the image they upload.
//   2. It copies NONE OF THE CONTENT. The card they photograph is often not
//      theirs; a template found online belongs to nobody. Not one character of
//      the text printed on it may end up on their card.

const reading = (over: Record<string, unknown> = {}) => ({
  background: "#101820",
  textColor: "#ffffff",
  accentColor: "#c8a24a",
  skeleton: "mirror",
  blocks: [
    { id: "logo", emphasis: "normal", place: "panel" },
    { id: "company", emphasis: "hero" },
    { id: "name", emphasis: "normal" },
    { id: "phone", emphasis: "quiet" },
    { id: "email", emphasis: "quiet" },
  ],
  ...over,
});

const on = (l: ReturnType<typeof layoutFromScan>, id: string) =>
  (l.blocks ?? []).find((b) => b.id === id);

describe("copying a layout from an uploaded image", () => {
  it("puts the logo where the source card put it", () => {
    const panel = layoutFromScan(reading({ blocks: [{ id: "logo", place: "panel" }, { id: "name" }, { id: "email" }] }));
    const main = layoutFromScan(reading({ blocks: [{ id: "logo", place: "main" }, { id: "name" }, { id: "email" }] }));
    expect(zoneFor(on(panel, "logo")!)).toBe("left");
    expect(zoneFor(on(main, "logo")!)).toBe("right");
  });

  it("puts the headshot where the source card put it", () => {
    const panel = layoutFromScan(reading({ blocks: [{ id: "headshot", place: "panel" }, { id: "name" }, { id: "email" }] }));
    const main = layoutFromScan(reading({ blocks: [{ id: "headshot", place: "main" }, { id: "name" }, { id: "email" }] }));
    expect(zoneFor(on(panel, "headshot")!)).toBe("left");
    expect(zoneFor(on(main, "headshot")!)).toBe("right");
  });

  it("moves the QR into the panel when the source card has it there", () => {
    const l = layoutFromScan(reading({ blocks: [{ id: "qr", place: "panel" }, { id: "name" }, { id: "email" }] }));
    expect(zoneFor(on(l, "qr")!)).toBe("left");
  });

  it("keeps which side the panel is on", () => {
    expect(layoutFromScan(reading({ skeleton: "split" })).skeleton).toBe("split");
    expect(layoutFromScan(reading({ skeleton: "mirror" })).skeleton).toBe("mirror");
    expect(layoutFromScan(reading({ skeleton: "stacked" })).skeleton).toBe("stacked");
  });

  it("keeps the reading order and the relative weight of the text", () => {
    const l = layoutFromScan(reading());
    const text = (l.blocks ?? []).filter((b) => b.on && b.type === "field").map((b) => b.id);
    expect(text).toEqual(["company", "name", "phone", "email"]);
    expect(on(l, "company")!.emphasis).toBe("hero");
    expect(on(l, "phone")!.emphasis).toBe("quiet");
  });

  // The side panel is a third of the card wide, and a single unbroken token —
  // an email — either fits it or splits mid-word. So a model that reports the
  // phone number running down a coloured spine must not be able to put it
  // there, however confidently it says so.
  it("refuses to put text in the side panel even when the reading asks for it", () => {
    const l = layoutFromScan(reading({
      blocks: [
        { id: "name", place: "panel" }, { id: "email", place: "panel" },
        { id: "phone", place: "panel" }, { id: "address", place: "panel" },
      ],
    }));
    for (const id of ["name", "email", "phone", "address"]) {
      expect(zoneFor(on(l, id)!), `${id} must stay in the main area`).toBe("right");
    }
  });

  it("ignores a place it does not recognise rather than dropping the block", () => {
    for (const place of ["PANEL", "left", "", null, 7, {}, ["panel"]]) {
      const l = layoutFromScan(reading({ blocks: [{ id: "logo", place }, { id: "name" }, { id: "email" }] }));
      const logo = on(l, "logo");
      expect(logo, `place=${JSON.stringify(place)} must still produce a logo`).toBeTruthy();
      expect(["left", "right"]).toContain(zoneFor(logo!));
    }
  });

  // ── The half that matters most ────────────────────────────────────────────

  it("carries no text from the scanned card onto the layout", () => {
    // A reading that tries every route a value could take: as the block id, as
    // an extra property beside it, and as a whole extra field on the reading.
    const l = layoutFromScan(reading({
      companyName: "Vandermeer Capital",
      blocks: [
        { id: "company", emphasis: "hero", value: "Vandermeer Capital", text: "Vandermeer Capital" },
        { id: "name", label: "Bartholomew Fitzgerald" },
        { id: "phone", value: "312-555-0148" },
        { id: "email", value: "bart@vandermeer.example" },
        { id: "address", value: "1200 Avenue of the Americas" },
      ],
    }));
    const serialised = JSON.stringify(l);
    for (const secret of [
      "Vandermeer", "Bartholomew", "Fitzgerald", "312-555-0148",
      "bart@vandermeer.example", "Avenue of the Americas",
    ]) {
      expect(serialised, `"${secret}" leaked out of the scanned card`).not.toContain(secret);
    }
  });

  it("builds field blocks that reference a field, never a literal value", () => {
    const l = layoutFromScan(reading());
    for (const b of l.blocks ?? []) {
      expect(b, `${b.id} must not carry a literal value`).not.toHaveProperty("value");
      expect(b, `${b.id} must not carry literal text`).not.toHaveProperty("text");
    }
  });

  it("tells the model to report layout only, and not to transcribe anything", () => {
    expect(SCAN_PROMPT).toMatch(/Do NOT read, transcribe/i);
    // Named explicitly, because "don't return text" alone did not stop a vision
    // model from volunteering the name it could plainly see.
    for (const kind of ["names", "job titles", "company names", "phone numbers", "emails", "addresses"]) {
      expect(SCAN_PROMPT).toContain(kind);
    }
  });

  it("asks about placement only for the blocks that can actually move", () => {
    expect(SCAN_PROMPT).toMatch(/place = only for logo, headshot, qr/);
    expect(SCAN_PROMPT).toContain('"place":"panel|main"');
  });

  it("accepts a template image, not just a photograph of a printed card", () => {
    expect(SCAN_PROMPT).toMatch(/screenshot of a card design or template/i);
  });
});
