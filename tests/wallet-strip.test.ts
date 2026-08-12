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

  it("builds the strip from a real-card capture: exact sizes, chrome sampled from the card", async () => {
    // Synthetic "capture": a dark navy card at the real 1.75:1 aspect.
    const sharp = (await import("sharp")).default;
    const capture = await sharp({
      create: { width: 700, height: 400, channels: 3, background: { r: 13, g: 27, b: 62 } },
    }).png().toBuffer();

    const design = await captureToDesign(capture);
    expect(design).not.toBeNull();
    // bare: the real-card tier renders a coupon-layout pass with nothing but
    // the card — no barcode block, no contact rows (buildPkpass keys on this).
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
    // Dark card → dark chrome in the card's own color, wordmark allowed.
    expect(design!.theme.darkChrome).toBe(true);
    expect(design!.theme.backgroundColor).toBe("rgb(13, 27, 62)");

    // A capture outside the card aspect window is rejected (falls to Tier 2).
    const square = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
    expect(await captureToDesign(square)).toBeNull();
  }, 30_000);

  it("bare passes carry NO Apple barcode block — the card art has its own QR", async () => {
    // Owner's call 2026-08-11: the real-card capture already shows the card's
    // own QR, so pass.setBarcodes() printed a SECOND QR under the card. This
    // pins the guard at the source level because buildPkpass can't run in
    // tests (it needs the Apple signing certs). The mechanism: setBarcodes is
    // reached only when the design is not bare.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/wallet.ts", "utf8");
    const guard = src.indexOf("if (!design?.bare)");
    const barcodes = src.indexOf("pass.setBarcodes(");
    expect(guard, "the bare guard around setBarcodes is gone").toBeGreaterThan(-1);
    expect(barcodes).toBeGreaterThan(guard);
    // ...and it must still be set for the non-bare tiers (their strips carry
    // no QR at all — dropping it there would make those passes unscannable).
    expect(src.slice(guard, barcodes)).not.toMatch(/\breturn\b/);
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
