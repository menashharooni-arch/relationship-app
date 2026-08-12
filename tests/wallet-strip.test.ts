import { describe, expect, it } from "vitest";
import { captureToDesign, passTheme, renderCardStrips } from "@/lib/wallet-strip";

// The Wallet pass's card-styled strip must actually render — if Satori or
// sharp break (glyphs, wasm, resize), the route silently degrades to the
// plain navy pass and the regression is invisible in production. Rendering
// here keeps that failure loud. No-photo metas only, so nothing touches the
// network.
const meta = (template: string | null) => ({
  name: "Alex Chen",
  title: "Founder & Principal",
  company: "Northbeam Studio",
  photoUrl: null,
  logoUrl: null,
  phone: "4155550192",
  email: "alex@example.com",
  website: null,
  address: null,
  accentColor: "#3b82f6",
  template,
});

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const pngSize = (b: Buffer) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });

describe("wallet pass strip", () => {
  it("renders every template's strip as correctly-sized PNGs", async () => {
    for (const t of ["modern-bold", "classic-pro", "photo-first", "local-business", "luxury-minimal", "logo-first", "custom", null]) {
      const strips = await renderCardStrips(meta(t));
      for (const [buf, w, h] of [
        [strips.x1, 375, 123],
        [strips.x2, 750, 246],
        [strips.x3, 1125, 369],
      ] as const) {
        expect(buf.subarray(0, 4).equals(PNG), `${t}: PNG magic`).toBe(true);
        expect(pngSize(buf), `${t}: dimensions`).toEqual({ w, h });
      }
    }
  }, 60_000);

  it("builds the strip from a real-card capture: exact sizes, chrome is the shared ground", async () => {
    // Synthetic "capture": a dark navy card at the real 1.75:1 aspect.
    const sharp = (await import("sharp")).default;
    const capture = await sharp({
      create: { width: 700, height: 400, channels: 3, background: { r: 13, g: 27, b: 62 } },
    }).png().toBuffer();

    const design = await captureToDesign(capture);
    expect(design).not.toBeNull();
    // bare: the real-card tier shows the card and Apple's QR block and nothing
    // else — no contact rows between them (buildPkpass keys on this).
    expect(design!.bare).toBe(true);
    // storeCard strip geometry — clean rounded pass edges (coupon serrates).
    for (const [buf, w, h] of [
      [design!.strips.x1, 375, 123],
      [design!.strips.x2, 750, 246],
      [design!.strips.x3, 1125, 369],
    ] as const) {
      expect(buf.subarray(0, 4).equals(PNG)).toBe(true);
      expect(pngSize(buf)).toEqual({ w, h });
    }
    // Chrome is the GROUND, not the card. It is one light neutral for every
    // card so the strip's ground and the pass body are a single surface — a
    // per-card sampled colour left a visible seam where the strip ends.
    expect(design!.theme.darkChrome).toBe(false);
    expect(design!.theme.backgroundColor).toBe("rgb(239, 238, 243)");

    // A capture outside the card aspect window is rejected (falls to Tier 2).
    const square = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
    expect(await captureToDesign(square)).toBeNull();
  }, 30_000);

  it("the card sits ON the ground: flat neutral to the borders, card centred and inset", async () => {
    const sharp = (await import("sharp")).default;
    // A card with DISTINCT edge colours: red left half, navy right half. The
    // old design bled those hues to the strip borders with a blurred echo; the
    // current one puts the card on a flat neutral ground, so the borders must
    // be that ground and nothing else.
    const left = { r: 200, g: 30, b: 30 }, right = { r: 13, g: 27, b: 62 };
    const capture = await sharp({ create: { width: 700, height: 400, channels: 3, background: left } })
      .composite([{
        input: await sharp({ create: { width: 350, height: 400, channels: 3, background: right } }).png().toBuffer(),
        left: 350, top: 0,
      }]).png().toBuffer();

    const design = await captureToDesign(capture);
    expect(design).not.toBeNull();
    for (const [buf, w, h] of [
      [design!.strips.x1, 375, 123],
      [design!.strips.x2, 750, 246],
      [design!.strips.x3, 1125, 369],
    ] as const) {
      expect(buf.subarray(0, 4).equals(PNG)).toBe(true);
      expect(pngSize(buf)).toEqual({ w, h });
    }

    const raw = await sharp(design!.strips.x3).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => {
      const i = (y * raw.info.width + x) * raw.info.channels;
      return [raw.data[i], raw.data[i + 1], raw.data[i + 2]];
    };

    // Border is the ground — NOT the card's red bleeding outward.
    const [lr, lg, lb] = px(3, 184);
    expect([lr, lg, lb], "left border must be the flat ground").toEqual([0xef, 0xee, 0xf3]);
    expect(px(raw.info.width - 4, 184), "right border too").toEqual([0xef, 0xee, 0xf3]);

    // The card is still THERE and centred: mid-left of the card reads red,
    // mid-right reads navy. Without this the test would pass on a blank strip.
    const [cr, cg] = px(Math.round(raw.info.width * 0.35), 184);
    expect(cr, "card's red half should be present left of centre").toBeGreaterThan(120);
    expect(cr).toBeGreaterThan(cg + 40);
    const [nr, , nb] = px(Math.round(raw.info.width * 0.65), 184);
    expect(nb, "card's navy half should be present right of centre").toBeGreaterThan(nr);

    // Ground runs along the top edge too — the card is inset, not full-bleed.
    expect(px(Math.round(raw.info.width / 2), 1), "top edge is ground").toEqual([0xef, 0xee, 0xf3]);
  }, 30_000);

  it("EVERY pass carries the QR block — bare included (owner spec: QR fills the bottom)", async () => {
    // Owner's final spec 2026-08-11: card art up top, Apple's big QR below.
    // Source-level pin because buildPkpass can't run in tests (it needs the
    // Apple signing certs): setBarcodes must be UNCONDITIONAL — reachable on
    // every path, not gated on the design tier.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/wallet.ts", "utf8");
    const barcodes = src.indexOf("pass.setBarcodes(");
    expect(barcodes).toBeGreaterThan(-1);
    const before = src.slice(Math.max(0, barcodes - 220), barcodes);
    expect(before, "setBarcodes got re-gated").not.toMatch(/if\s*\(.*design.*\)\s*\{\s*$/);
  });

  it("themes chrome per template — light templates must not carry the white wordmark", () => {
    expect(passTheme(meta("modern-bold")).darkChrome).toBe(true);
    expect(passTheme(meta("logo-first")).darkChrome).toBe(true);
    for (const t of ["classic-pro", "photo-first", "local-business", "luxury-minimal", "custom"]) {
      expect(passTheme(meta(t)).darkChrome, t).toBe(false);
    }
    // The owner's accent reaches the pass labels.
    expect(passTheme(meta("classic-pro")).labelColor).toBe("rgb(59, 130, 246)");
  });
});
