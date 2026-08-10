import { describe, expect, it } from "vitest";
import { passTheme, renderCardStrips } from "@/lib/wallet-strip";

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
