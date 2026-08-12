import { describe, expect, it } from "vitest";
import type { ResolvedCardMeta } from "@/lib/resolve-card";
import { bandVariant, passThemeFrom, renderPassStrips, sampleSurface } from "@/lib/wallet-strip";
import { passPalette, yiq, hexStops } from "@/lib/wallet-palette";
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
 * The band pads 60px (@3x) on each side and centres its content vertically
 * with at least 64px of air, so a healthy render has uniform surface colour in
 * those gutters. Anything else — a clipped name, an oversized logo, a photo
 * that didn't respect its box — shows up as variation there. This is a direct
 * pixel check rather than a proxy for one, because the failure this replaces
 * was invisible to every other kind of test.
 */
async function gutterIsClean(png: Buffer, w: number, h: number): Promise<{ ok: boolean; where?: string }> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const at = (x: number, y: number) => {
    const i = (y * info.width + x) * ch;
    return [data[i], data[i + 1], data[i + 2]] as const;
  };
  // The surface is a vertical ramp, so compare each pixel against the leftmost
  // pixel of ITS OWN row — a horizontal difference is content, a vertical one
  // is just the gradient.
  const MARGIN_X = Math.round(w * 0.032); // 36px of the 60px pad, @3x
  const MARGIN_Y = Math.round(h * 0.06);  // 22px of the 64px of air
  const TOL = 6;

  for (let y = 0; y < info.height; y++) {
    const ref = at(0, y);
    for (const x of [...range(0, MARGIN_X), ...range(info.width - MARGIN_X, info.width)]) {
      const p = at(x, y);
      if (Math.abs(p[0] - ref[0]) > TOL || Math.abs(p[1] - ref[1]) > TOL || Math.abs(p[2] - ref[2]) > TOL) {
        return { ok: false, where: `side gutter at ${x},${y}` };
      }
    }
  }
  for (const y of [...range(0, MARGIN_Y), ...range(info.height - MARGIN_Y, info.height)]) {
    const ref = at(0, y);
    for (let x = 0; x < info.width; x++) {
      const p = at(x, y);
      if (Math.abs(p[0] - ref[0]) > TOL || Math.abs(p[1] - ref[1]) > TOL || Math.abs(p[2] - ref[2]) > TOL) {
        return { ok: false, where: `top/bottom gutter at ${x},${y}` };
      }
    }
  }
  return { ok: true };
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = Math.max(0, a); i < b; i++) out.push(i);
  return out;
}

describe("wallet pass band renders", () => {
  it("renders every template at exactly the sizes Apple expects", async () => {
    for (const t of TEMPLATES) {
      const m = meta({ template: t });
      const strips = await renderPassStrips(m, passPalette(m));
      for (const [buf, w, h] of [
        [strips.x1, 375, 123], [strips.x2, 750, 246], [strips.x3, 1125, 369],
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
    ];
    for (const [label, design] of designs) {
      for (const [cname, content] of Object.entries(CONTENT)) {
        const m = { ...design, ...content };
        const strips = await renderPassStrips(m, passPalette(m));
        const res = await gutterIsClean(strips.x3, 1125, 369);
        expect(res.ok, `${label} / ${cname}: ${res.where}`).toBe(true);
      }
    }
  }, 600_000);
});
