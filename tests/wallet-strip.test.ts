import { describe, expect, it } from "vitest";
import type { ResolvedCardMeta } from "@/lib/resolve-card";
import { bandVariant, passThemeFrom, renderPassStrips, sampleSurface } from "@/lib/wallet-strip";
import { passPalette, yiq, hexStops } from "@/lib/wallet-palette";
import { getFinish } from "@/lib/card-finishes";
import { fitLine, textEm, wrapLines } from "@/lib/wallet-fit";

// The Wallet band has to hold every card the product can produce — six preset
// templates, their Pro colour overrides, custom block layouts, and a
// design-transfer card that is only an image — without clipping a name,
// overlapping a mark, or putting text on a ground it can't be read against.
//
// So this file does three things: prove the fitting maths can't return
// something wider than its box, prove the palette always resolves to readable
// colour, and then RENDER the whole matrix and inspect the actual pixels for
// overflow. The last one is the only test that would have caught the previous
// design's real failure, which was visual and typechecked fine.

type Meta = NonNullable<ResolvedCardMeta>;

const base: Meta = {
  name: "Aaron Lavi",
  title: "Director of Originations",
  company: "Malve Capital",
  photoUrl: null,
  logoUrl: null,
  phone: "9179057335",
  email: "aaron@malvecapital.com",
  website: null,
  address: null,
  accentColor: null,
  template: null,
  style: {},
  custom: null,
};

const meta = (over: Partial<Meta>): Meta => ({ ...base, ...over });

const TEMPLATES = [
  "modern-bold", "classic-pro", "photo-first", "local-business",
  "luxury-minimal", "logo-first", "unknown-template", null,
] as const;

// Custom designs, covering the shapes the designer can actually save.
const CUSTOM: Record<string, Meta["custom"]> = {
  "custom-two-tone": {
    background: "#141b26", textColor: "#ffffff", accentColor: "#7fa6f0",
    panelBackground: "#0b1220", panelTextColor: "#ffffff", fontFamily: "sans-serif",
  },
  "custom-gradient": {
    background: "#fffdf7", textColor: "#1c1612", accentColor: "#b45309",
    panelBackground: "linear-gradient(200deg, #1d4ed8 0%, #3b82f6 100%)",
    panelTextColor: "#ffffff", fontFamily: "sans-serif",
  },
  "custom-light": {
    background: "#fafaf6", textColor: "#1c1612", accentColor: "#c9a96e", fontFamily: "sans-serif",
  },
  // The contrast trap: white text saved against a white ground. Reachable in
  // the editor, and present on real cards.
  "custom-unreadable": {
    background: "#ffffff", textColor: "#ffffff", accentColor: "#fefefe", fontFamily: "sans-serif",
  },
};

// Content edge cases — the strings that break fixed-height single-line boxes.
const CONTENT: Record<string, Partial<Meta>> = {
  "normal": {},
  "long-name": { name: "Konstantinos Papadopoulos-Winterbottom" },
  "one-long-word": { name: "Bartholomewsteinbergsson" },
  "short": { name: "Al", title: null, company: null },
  "no-title": { title: null },
  "no-company": { company: null },
  "name-only": { title: null, company: null },
  "long-everything": {
    name: "Alexandra Featherstonehaugh",
    title: "Senior Vice President of Institutional Originations & Capital Markets",
    company: "Featherstonehaugh, Wintermute & Associates International LLP",
  },
  "cjk": { name: "田中太郎", title: "最高経営責任者", company: "株式会社日本橋コーポレーション" },
  "emoji": { name: "Aaron Lavi 🚀", company: "Malve Capital 🏦✨" },
  "all-caps": { name: "AARON LAVI", title: "SENIOR VICE PRESIDENT", company: "MALVE CAPITAL GROUP" },
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const pngSize = (b: Buffer) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });

// ── 1. The fitting can't overflow, by construction ──────────────────────────

describe("wallet-fit", () => {
  it("never returns a line wider than its box", () => {
    const SAFETY = 1.12; // must match wallet-fit
    const strings = [
      "Aaron Lavi", "Konstantinos Papadopoulos-Winterbottom", "Bartholomewsteinbergsson",
      "田中太郎 株式会社日本橋コーポレーション", "Malve Capital 🏦✨", "WWWWWWWWWWWWWWWWWWWWWWWW",
      "MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM", "A", "", "   ",
      "Featherstonehaugh, Wintermute & Associates International LLP",
    ];
    for (const box of [180, 400, 719, 1005]) {
      for (const s of strings) {
        for (const caps of [false, true]) {
          const fit = fitLine(s, { box, base: 80, min: 34, uppercase: caps, tracking: caps ? 0.05 : 0 });
          const tracking = parseFloat(fit.letterSpacing);
          const width =
            (textEm(fit.text, caps) + Array.from(fit.text).length * tracking) * fit.fontSize * SAFETY;
          expect(width, `"${s}" @${box}px caps=${caps} → "${fit.text}"`).toBeLessThanOrEqual(box + 0.01);
        }
      }
    }
  });

  it("never exceeds its line budget, for any string on any band width", () => {
    // The defect this replaces: "LEV LEV EDUCATIONAL FUND" satisfied a
    // two-line WIDTH budget and then wrapped to three, overflowing the band
    // and pushing the job title out of the layout.
    const strings = [
      "LEV LEV EDUCATIONAL FUND", "Lev Lev Educational Fund",
      "Konstantinos Papadopoulos-Winterbottom", "Alexandra Featherstonehaugh",
      "Featherstonehaugh, Wintermute & Associates International LLP",
      "田中太郎 株式会社日本橋コーポレーション", "Aaron Lavi", "Al",
      "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z",
    ];
    for (const box of [200, 400, 719, 838, 1005]) {
      for (const caps of [false, true]) {
        for (const maxLines of [1, 2]) {
          for (const s of strings) {
            const fit = fitLine(s, { box, base: 84, min: 34, uppercase: caps, tracking: caps ? 0.05 : 0, maxLines });
            if (!fit.text) continue;
            const tracking = parseFloat(fit.letterSpacing);
            const laid = wrapLines(fit.text, fit.fontSize, tracking, box, caps);
            expect(laid.length, `"${s}" @${box} caps=${caps} max=${maxLines} → ${laid.length} lines`)
              .toBeLessThanOrEqual(maxLines);
            expect(fit.lines).toBe(laid.length);
            for (const line of laid) {
              expect(textEm(line, caps) * fit.fontSize * 1.12 + line.length * tracking * fit.fontSize * 1.12)
                .toBeLessThanOrEqual(box + 0.01);
            }
          }
        }
      }
    }
  });

  it("keeps one name size across cards instead of resizing per card", () => {
    // Every name that fits comes out at the base size — a wallet full of
    // passes set at different sizes reads as broken, not responsive.
    for (const n of ["Aaron Lavi", "Al", "Alex Chen", "Menash Harooni"]) {
      expect(fitLine(n, { box: 719, base: 84, min: 34, maxLines: 2 }).fontSize).toBe(84);
    }
  });

  it("shrinks before it cuts, and only cuts at the floor", () => {
    // Two lines, as the band gives the name — a real long name must survive whole.
    const long = fitLine("Konstantinos Papadopoulos-Winterbottom", { box: 719, base: 84, min: 34, maxLines: 2 });
    expect(long.truncated).toBe(false);
    expect(long.text).toBe("Konstantinos Papadopoulos-Winterbottom");
    expect(long.fontSize).toBeLessThan(84);
    expect(long.fontSize).toBeGreaterThanOrEqual(34);

    const absurd = fitLine("M".repeat(200), { box: 400, base: 80, min: 34 });
    expect(absurd.truncated).toBe(true);
    expect(absurd.fontSize).toBe(34);
    expect(absurd.text.endsWith("…")).toBe(true);
  });

  it("keeps the longest WORD on one line even when wrapping is allowed", () => {
    // Budgeting only the two-line total would size this so the long word alone
    // overruns the box and Satori breaks it mid-word.
    const box = 719;
    const fit = fitLine("Jo Bartholomewsteinbergssonhausen", { box, base: 84, min: 20, maxLines: 2 });
    const word = "Bartholomewsteinbergssonhausen";
    expect(textEm(word, false) * fit.fontSize * 1.12).toBeLessThanOrEqual(box + 0.01);
  });

  it("measures non-Latin as full-width — a Latin average under-measures by a third", () => {
    expect(textEm("日本橋", false)).toBe(3);
    expect(textEm("abc", false)).toBeLessThan(2.2);
  });

  it("treats an emoji as one character when cutting", () => {
    const fit = fitLine("🚀".repeat(60), { box: 200, base: 80, min: 34 });
    // No lone surrogates: a split emoji renders as tofu on the pass.
    expect(fit.text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
});

// ── 2. The palette always resolves to something readable ────────────────────

describe("wallet-palette", () => {
  const readable = (a: string, b: string) => Math.abs(yiq(a) - yiq(b));

  it("gives every template and custom design readable ink on its own surface", () => {
    const designs: Meta[] = [
      ...TEMPLATES.map((t) => meta({ template: t })),
      ...Object.values(CUSTOM).map((c) => meta({ template: "custom", custom: c })),
    ];
    for (const m of designs) {
      const p = passPalette(m);
      const worst = yiq(p.top) < yiq(p.bottom) ? p.bottom : p.top;
      expect(readable(p.ink, worst), `${m.template}: ink vs surface`).toBeGreaterThanOrEqual(60);
    }
  });

  it("rescues the white-on-white card rather than rendering it invisible", () => {
    const p = passPalette(meta({ template: "custom", custom: CUSTOM["custom-unreadable"] }));
    expect(yiq(p.ink)).toBeLessThan(150); // dark ink chosen for the white ground
    expect(readable(p.ink, p.bottom)).toBeGreaterThanOrEqual(60);
  });

  it("lifts an accent that would vanish instead of throwing the brand colour away", () => {
    // A near-ground accent on navy. CustomCard's ramp() drops this to the text
    // colour; on the pass the accent is the ONLY trace of the brand, so it is
    // lifted until it separates, keeping its hue.
    const p = passPalette(meta({
      template: "custom",
      custom: { background: "#0b1220", textColor: "#ffffff", accentColor: "#101b30", fontFamily: "sans-serif" },
    }));
    expect(readable(p.accent, p.bottom)).toBeGreaterThanOrEqual(40);
    // Still blue — lifting desaturates, it does not replace.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(p.accent.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it("uses the PRESET palette when a card only carries a stale custom layout", () => {
    // The real regression: aaron-lavi-malve-capital renders photo-first and
    // still holds a customLayout blob from a visit to the designer. The blob
    // is kept deliberately (switching back restores it), so resolveCardMeta
    // now hands `custom: null` for any card not actually drawn custom — and
    // the palette must then be the template's, not the layout's navy.
    const p = passPalette(meta({ template: "photo-first", custom: null }));
    expect(p.top).toBe("#4f46e5");
    expect(p.bottom).toBe("#6d28d9");
  });

  it("honours Pro style overrides on a preset template", () => {
    const p = passPalette(meta({ template: "modern-bold", style: { bgColor: "#7c2d12", textColor: "#fff7ed", accentColor: "#fdba74" } }));
    expect(p.bottom).toBe("#7c2d12");
    expect(p.ink).toBe("#fff7ed");
    expect(p.accent).toBe("#fdba74");
  });

  it("reads a gradient's LAST stop as the colour the band ends on", () => {
    const p = passPalette(meta({
      template: "custom",
      custom: {
        background: "#ffffff", textColor: "#111111", fontFamily: "sans-serif",
        panelBackground: "linear-gradient(200deg, #1d4ed8 0%, #3b82f6 100%)", panelTextColor: "#ffffff",
      },
    }));
    expect(p.top).toBe("#1d4ed8");
    expect(p.bottom).toBe("#3b82f6");
  });

  it("a two-tone card's pass body is the card's details side", () => {
    // Owner's choice, 2026-09-18: Classic Pro is a navy panel beside a white
    // details side, so the pass is a navy band over a white body with the
    // phone and email in the card's navy and the labels in its blue.
    const p = passPalette(meta({ template: "classic-pro" }));
    expect(p.twoTone).toBe(true);
    expect(p.body).toEqual({ background: "#ffffff", value: "#0e1b35", label: "#2563eb" });
    expect(p.surface.base).toBe("linear-gradient(160deg, #0e1b35 0%, #162947 100%)");
    const theme = passThemeFrom(p);
    expect(theme.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(theme.foregroundColor).toBe("rgb(14, 27, 53)");
  });

  it("a single-surface card's band ends on exactly the colour of the body — no seam", () => {
    for (const t of ["modern-bold", "luxury-minimal", "logo-first"]) {
      const p = passPalette(meta({ template: t, style: { bgColor: "linear-gradient(135deg, #111827 0%, #6d28d9 100%)" } }));
      expect(p.twoTone, t).toBe(false);
      expect(p.surface.base, t).toBe("linear-gradient(180deg, #111827 0%, #6d28d9 100%)");
      expect(p.body.background, t).toBe("#6d28d9");
      expect(p.surface.fadeTo, t).toBe("#6d28d9");
    }
  });

  it("one accent colour reaches every accent on the pass", () => {
    // "If the QR code on the actual card is pink ..." — Modern Bold draws its
    // title, rule, contact icons and QR in the accent. Apple's QR can't be
    // coloured; everything else the card draws pink, the pass draws pink.
    const pink = "#ec4899";
    const p = passPalette(meta({ template: "modern-bold", style: { accentColor: pink } }));
    expect(p.title).toBe(pink);
    expect(p.accent).toBe(pink);
    expect(p.rule?.color).toBe(pink);
    expect(p.body.label).toBe(pink);
  });

  it("lays the card's finish over the band, and the template's own texture over that", () => {
    const linen = getFinish("linen").layers;
    const p = passPalette(meta({ template: "classic-pro", style: { finish: "linen" } }));
    const images = p.surface.layers.map((l) => l.image);
    for (const layer of linen) expect(images).toContain(layer);
    // The dot grid is Classic Pro's texture div, drawn above the panel.
    expect(images[images.length - 1]).toMatch(/radial-gradient/);
    // A card with no finish carries only its template texture.
    expect(passPalette(meta({ template: "classic-pro" })).surface.layers).toHaveLength(1);
  });

  it("Photo First's finish belongs to its details panel, which the band is not", () => {
    // On this template bgColor — and so the finish and panel photo — paints
    // the INFO panel; surfaceColor paints the photo panel the band copies.
    const p = passPalette(meta({ template: "photo-first", style: { finish: "linen", bgColor: "#0a0a0a", surfaceColor: "#064e3b" } }));
    expect(p.surface.base).toBe("#064e3b");
    expect(p.surface.layers.map((l) => l.image)).not.toContain(getFinish("linen").layers[0]);
    expect(p.body.background).toBe("#0a0a0a");
    expect(p.body.value).toBe("#ffffff");
  });

  it("chrome colours are the rgb() form pass.json requires", () => {
    const theme = passThemeFrom(passPalette(meta({ template: "modern-bold" })));
    for (const v of [theme.backgroundColor, theme.foregroundColor, theme.labelColor]) {
      expect(v).toMatch(/^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/);
    }
  });

  it("samples a design-transfer face image instead of inventing a colour", async () => {
    const sharp = (await import("sharp")).default;
    const face = await sharp({ create: { width: 700, height: 400, channels: 3, background: { r: 122, g: 30, b: 60 } } }).png().toBuffer();
    const sampled = await sampleSurface(face);
    expect(sampled).not.toBeNull();
    const [r] = hexStops(sampled!.bottom).length ? [sampled!.bottom] : [];
    expect(r).toBeDefined();

    const p = passPalette(
      meta({ template: "custom", custom: { background: "#000", textColor: "#fff", fontFamily: "sans-serif", faceImage: "https://swiftcard.me/x.png" } }),
      sampled,
    );
    // The sampled maroon, not the layout's black.
    expect(yiq(p.bottom)).toBeGreaterThan(20);
    expect(yiq(p.bottom)).toBeLessThan(120);
  });

  it("always leads with the same square, whatever the card has", () => {
    // Both variants occupy an identical 241px lead, so the text column starts
    // at the same x on every pass. What changes is only what fills it.
    const cases: [Parameters<typeof bandVariant>[0], boolean, boolean, string][] = [
      // A mark-led template: logo, else a headshot, else a company monogram.
      ["mark", false, true, "mark"],
      ["mark", true, false, "portrait"],
      ["mark", false, false, "mark"],
      // A portrait-led template: headshot, else a logo, else initials.
      ["portrait", true, false, "portrait"],
      ["portrait", false, true, "mark"],
      ["portrait", false, false, "portrait"],
      // A type-led template shows a logo when the card has one (its card
      // template does) and never a headshot (its card template doesn't).
      ["type", true, true, "mark"],
      ["type", true, false, "mark"],
      ["type", false, false, "mark"],
    ];
    for (const [prefer, photo, logo, want] of cases) {
      expect(bandVariant(prefer, photo, logo), `${prefer} photo=${photo} logo=${logo}`).toBe(want);
    }
  });
});

// ── 3. The rendered pixels: nothing reaches the edge ────────────────────────

/**
 * Does any content touch the outer margin?
 *
 * The band pads 108px (@3x) on the left and 72px on the right and centres its
 * content vertically with room to spare, so in a healthy render the margins
 * hold nothing but the card's own surface. Anything else — a clipped name, an
 * oversized logo, a photo that didn't respect its box — shows up there.
 *
 * "The surface" is not one colour any more: a Linen or Carbon finish, a dot
 * grid, a foil edge and an accent bar are all part of the card's panel. So the
 * reference is the SAME band rendered with its surface alone (surfaceOnly),
 * and any pixel in the margins that differs from it is content. This is a
 * direct pixel check rather than a proxy for one, because the failure it
 * guards was invisible to every other kind of test.
 */
async function gutterIsClean(png: Buffer, surface: Buffer): Promise<{ ok: boolean; where?: string }> {
  const sharp = (await import("sharp")).default;
  const a = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(surface).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = a.info;
  const differs = (x: number, y: number) => {
    const i = (y * w + x) * ch;
    return Math.abs(a.data[i] - b.data[i]) > TOL || Math.abs(a.data[i + 1] - b.data[i + 1]) > TOL || Math.abs(a.data[i + 2] - b.data[i + 2]) > TOL;
  };
  // The LEFT margin is checked harder than the right. Wallet masks the strip
  // to the pass's rounded corners and scales it to the device's pass width,
  // and the leading edge is where that costs something — the headshot, logo
  // and monogram all live there, and they were reported cut off on device at
  // the old 20pt lead-in. 84px of the 108px pad must be clear.
  const MARGIN_L = Math.round(w * 0.075); // 84px of the 108px left pad, @3x
  const MARGIN_R = Math.round(w * 0.042); // 48px of the 72px right pad, @3x
  // Vertically, the margin has to cover the OTHER reading of the slot: if a
  // renderer ever treats a storeCard strip as 123pt tall, our 144pt image is
  // cropped 10.5pt (31.5px @3x) off the top and bottom. Requiring 37px of
  // clear surface at each end means content survives either way.
  const MARGIN_Y = Math.round(h * 0.085); // 37px — covers a 31.5px vertical crop

  for (let y = 0; y < h; y++) {
    for (const x of [...range(0, MARGIN_L), ...range(w - MARGIN_R, w)]) {
      if (differs(x, y)) return { ok: false, where: `side gutter at ${x},${y}` };
    }
  }
  for (const y of [...range(0, MARGIN_Y), ...range(h - MARGIN_Y, h)]) {
    for (let x = 0; x < w; x++) {
      if (differs(x, y)) return { ok: false, where: `top/bottom gutter at ${x},${y}` };
    }
  }
  return { ok: true };
}

const TOL = 6;

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = Math.max(0, a); i < b; i++) out.push(i);
  return out;
}

// Textured and restyled cards — the ones whose surface is not a flat colour.
const FINISHED: [string, Meta][] = [
  ["classic-pro+linen", meta({ template: "classic-pro", style: { finish: "linen" } })],
  ["modern-bold+carbon+pink", meta({ template: "modern-bold", style: { finish: "carbon", accentColor: "#ec4899" } })],
  ["local-business+brushed", meta({ template: "local-business", style: { finish: "brushed" } })],
  ["luxury-minimal+gilt", meta({ template: "luxury-minimal", style: { finish: "gilt" } })],
  ["logo-first+frosted", meta({ template: "logo-first", style: { finish: "frosted" } })],
  ["photo-first+halo", meta({ template: "photo-first", style: { finish: "halo" } })],
  ["modern-bold+sheen+light", meta({ template: "modern-bold", style: { finish: "sheen", bgColor: "#f8fafc", textColor: "#0f172a" } })],
];

describe("wallet pass band renders", () => {
  it("renders every template at exactly the sizes Apple expects", async () => {
    // 375x144, not 375x123. The 123pt slot is the one a storeCard gets when it
    // carries a HEADER FIELD; this pass has none, so the slot is 144pt and
    // Wallet aspect-FILLS it. A 123-tall image had to scale up 144/123 to
    // cover that height, which made it 439pt wide inside a 375pt pass and
    // cropped 32pt off each side — the reported "cut off on the left", since
    // the leading edge is where the headshot and logo sit.
    for (const t of TEMPLATES) {
      const m = meta({ template: t });
      const strips = await renderPassStrips(m, passPalette(m));
      for (const [buf, w, h] of [
        [strips.x1, 375, 144], [strips.x2, 750, 288], [strips.x3, 1125, 432],
      ] as const) {
        expect(buf.subarray(0, 4).equals(PNG), `${t}: PNG magic`).toBe(true);
        expect(pngSize(buf), `${t}: dimensions`).toEqual({ w, h });
      }
    }
  }, 120_000);

  it("keeps content off the edges for every design × every content edge case", async () => {
    const designs: [string, Meta][] = [
      ...TEMPLATES.map((t) => [String(t), meta({ template: t })] as [string, Meta]),
      ...Object.entries(CUSTOM).map(([k, c]) => [k, meta({ template: "custom", custom: c })] as [string, Meta]),
      ...FINISHED,
    ];
    for (const [label, design] of designs) {
      const surface = (await renderPassStrips(design, passPalette(design), { surfaceOnly: true })).x3;
      for (const [cname, content] of Object.entries(CONTENT)) {
        const m = { ...design, ...content };
        const strips = await renderPassStrips(m, passPalette(m));
        const res = await gutterIsClean(strips.x3, surface);
        expect(res.ok, `${label} / ${cname}: ${res.where}`).toBe(true);
      }
    }
  }, 900_000);

  it("draws the card's texture — a Linen card's band is not a flat colour", async () => {
    // The owner's words: "if the background of the card is textured, like
    // linen, then you do the same thing to the pass." Measured, not trusted:
    // the linen band's surface must vary pixel to pixel where the flat one is
    // uniform, in a patch well away from any content.
    const sharp = (await import("sharp")).default;
    const spread = async (m: Meta) => {
      const png = (await renderPassStrips(m, passPalette(m), { surfaceOnly: true })).x3;
      const { data, info } = await sharp(png).extract({ left: 1000, top: 40, width: 60, height: 60 }).raw().toBuffer({ resolveWithObject: true });
      let lo = 255, hi = 0;
      for (let i = 0; i < data.length; i += info.channels) { lo = Math.min(lo, data[i + 2]); hi = Math.max(hi, data[i + 2]); }
      return hi - lo;
    };
    // Modern Bold's own grid is 2% white — present, but under the threshold.
    const flat = await spread(meta({ template: "luxury-minimal" }));
    const linen = await spread(meta({ template: "luxury-minimal", style: { finish: "linen", bgColor: "#1c1612" } }));
    expect(flat).toBeLessThanOrEqual(2);
    expect(linen).toBeGreaterThanOrEqual(4);
  }, 60_000);
});
