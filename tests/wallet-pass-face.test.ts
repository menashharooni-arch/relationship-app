import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import WalletPassFace from "@/components/WalletPassFace";
import { passPalette } from "@/lib/wallet-palette";
import { bandVariant, BAND_W, BAND_H, IMG, bandPx, bandBackground } from "@/lib/wallet-band";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// ─────────────────────────────────────────────────────────────────────────────
// WHAT WE SHOW IS WHAT THEY DOWNLOAD.
//
// The marketing surfaces used to draw a shrunken picture of the business card
// and call it the Apple Wallet pass. The real pass has never looked like that
// — it is a composed band, two contact fields and a big QR — so the mock was
// advertising a product that doesn't exist.
//
// The fix was to DERIVE the preview instead of drawing it: same palette
// function, same geometry constants. These tests pin that derivation, because
// a hand-tuned copy is exactly what drifts the next time the pass changes.
// ─────────────────────────────────────────────────────────────────────────────

const CARD = {
  name: "Alex Morgan",
  title: "Realtor®",
  company: "Coastline Realty",
  phone: "(415) 555-0188",
  email: "alex@coastlinerealty.com",
  template: "classic-pro",
  cardUrl: "https://swiftcard.me/card/alexmorgan",
};

describe("one geometry, two renderers", () => {
  it("the real Satori strip reads its measurements from lib/wallet-band", () => {
    const strip = read("src/lib/wallet-strip.tsx");
    expect(strip).toMatch(/from "@\/lib\/wallet-band"/);
    // The numbers must not also exist locally — that is how two copies drift.
    expect(strip).not.toMatch(/^const PAD_LEFT = \d+/m);
    expect(strip).not.toMatch(/^const IMG = \d+/m);
    expect(strip).not.toMatch(/^const NAME_BASE = /m);
  });

  it("the DOM preview reads the same module, and hardcodes no band sizes", () => {
    const face = read("src/components/WalletPassFace.tsx");
    expect(face).toMatch(/from "@\/lib\/wallet-band"/);
    expect(face).toMatch(/passPalette/);
    // Every band dimension goes through bandPx(), never a literal.
    expect(face).toMatch(/bandPx\(width, at3x\)/);
  });

  it("bandPx scales the @3x canvas proportionally", () => {
    // A 240px-wide pass renders the lead square at the same fraction of the
    // band that Satori renders it at 1125px.
    expect(bandPx(BAND_W, IMG)).toBeCloseTo(IMG, 5);
    expect(bandPx(240, IMG) / 240).toBeCloseTo(IMG / BAND_W, 6);
    expect(BAND_H / BAND_W).toBeCloseTo(432 / 1125, 6);
  });

  it("the band's surface is a 180deg ramp ending exactly on the pass background", () => {
    // The whole seam-free trick: pass.backgroundColor === palette.bottom.
    const p = passPalette({
      name: "A", title: null, company: null, photoUrl: null, logoUrl: null,
      phone: null, email: null, website: null, address: null,
      accentColor: null, template: "classic-pro", style: {}, custom: null,
    });
    const bg = bandBackground(p);
    if (p.top !== p.bottom) {
      expect(bg).toContain("180deg");
      expect(bg).toContain(p.bottom);
    } else {
      expect(bg).toBe(p.top);
    }
  });

  it("both renderers agree on which lead the band takes", () => {
    // portrait / mark is one decision, exported once.
    expect(bandVariant("portrait", true, false)).toBe("portrait");
    expect(bandVariant("mark", false, false)).toBe("mark");
    expect(bandVariant("type", true, true)).toBe("mark");
  });
});

describe("the preview shows the three things the pass actually contains", () => {
  const out = renderToStaticMarkup(h(WalletPassFace, { card: CARD, width: 240 }));

  it("the band — name, title and company", () => {
    expect(out).toContain("Alex Morgan");
    expect(out).toContain("Realtor®");
    expect(out).toContain("Coastline Realty");
  });

  it("the two secondary fields Wallet draws under the strip", () => {
    expect(out).toMatch(/Phone/i);
    expect(out).toContain("(415) 555-0188");
    expect(out).toMatch(/Email/i);
    expect(out).toContain("alex@coastlinerealty.com");
  });

  it("the barcode block, with the pass's own altText", () => {
    expect(out).toContain("<svg"); // QRCodeSVG
    expect(out).toContain("Scan to connect");
  });

  it("falls back to a monogram when there is no headshot or logo", () => {
    expect(out).toContain("AM");
  });

  it("never claims a phone-to-phone tap — the pass carries no NFC", () => {
    expect(out).not.toMatch(/NFC|tap (your|their) phone/i);
  });
});

describe("every surface that depicts the pass uses this one component", () => {
  it("the ways-to-share phones show the pass, not a shrunken business card", () => {
    const s = read("src/components/site/ShareWaysPhones.tsx");
    expect(s).toMatch(/<WalletPassFace/);
    // The old mock rendered a card template inside the Wallet phone.
    expect(s).not.toMatch(/ClassicPro/);
    expect(s).not.toMatch(/CardScaler/);
    // The tucked credit cards stay — that is what makes it read as Wallet.
    expect(s).toMatch(/TUCKED/);
  });

  it("nothing else draws its own pass face", () => {
    // If a second depiction ever appears, it has to come through here.
    for (const f of ["src/app/page.tsx", "src/app/products/[slug]/page.tsx"]) {
      const s = read(f);
      const drawsOwnPass = /strip|pkpass face|wallet-band/i.test(s) && !/ShareWaysPhones/.test(s);
      expect(drawsOwnPass, `${f} draws its own pass`).toBe(false);
    }
  });
});
