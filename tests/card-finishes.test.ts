import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CARD_FINISHES, FINISH_FAMILIES, FREE_FINISH_IDS, DEFAULT_FINISH,
  getFinish, isFreeFinish, cssUrl, composePanelBackground,
} from "@/lib/card-finishes";
import { templateStyle, panelBackground } from "@/lib/template-style";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// ── Finishes: the material laid over a card's panel colour ───────────────────
//
// Owner order 2026-09-10: "more ways to design our current templates, the same
// way we did it for SwiftLinks". The catch is that a card is not a Swift Links
// page — the same markup is rasterised for the download, drawn into link-preview
// images and pasted into email signatures — so the Swift Links `backdrop-filter`
// glass could not come across. Everything here exists to keep that true.

describe("nothing about an existing card changes", () => {
  it("a card with no finish and no media gets its base back untouched", () => {
    expect(composePanelBackground("#0E1B35")).toBe("#0E1B35");
    expect(composePanelBackground("#0E1B35", undefined, null)).toBe("#0E1B35");
    expect(composePanelBackground("#0E1B35", "flat")).toBe("#0E1B35");
  });

  it("an unknown finish falls back to Flat rather than rendering nothing", () => {
    expect(composePanelBackground("#0E1B35", "no-such-finish")).toBe("#0E1B35");
    expect(getFinish("no-such-finish").id).toBe(DEFAULT_FINISH);
  });

  it("templateStyle still reports undefined for a card that set none of it", () => {
    const s = templateStyle({ customization: {} });
    expect(s.finish).toBeUndefined();
    expect(s.panelMedia).toBeUndefined();
    expect(s.panelDim).toBeUndefined();
  });

  it("panelBackground hands back the template's own default when nothing is set", () => {
    const s = templateStyle({ customization: {} });
    expect(panelBackground(s, "#123456")).toBe("#123456");
  });
});

describe("painted, never blurred — the card is not only a web element", () => {
  // html-to-image (the download), next/og (link previews) and every mail client
  // ignore these. A finish using one looks right on screen and wrong in every
  // exported form, which is the whole reason this file is separate from the
  // Swift Links looks.
  it("no finish uses backdrop-filter, filter or mix-blend-mode", () => {
    const src = read("src/lib/card-finishes.ts");
    for (const f of CARD_FINISHES) {
      for (const layer of f.layers) {
        expect(layer, `${f.id} uses an effect that cannot rasterise`).not.toMatch(/backdrop-filter|filter:|mix-blend/i);
      }
    }
    // And the layers must be gradients — the only background type all four
    // renderers agree on.
    for (const f of CARD_FINISHES) {
      for (const layer of f.layers) {
        expect(layer, `${f.id} layer is not a gradient`).toMatch(/gradient\(/);
      }
    }
    expect(src).toContain("backdrop-filter");   // the explanation, in the header
  });

  it("every layer is written in rgba, so isDarkBg still finds the panel colour", () => {
    // isDarkBg reads the FIRST #rrggbb in the composed string to decide whether
    // a name needs light text. A finish layer containing a hex would be found
    // first and the card would flip its text colour for the wrong reason.
    for (const f of CARD_FINISHES) {
      for (const layer of f.layers) {
        expect(layer, `${f.id} layer contains a hex colour`).not.toMatch(/#[0-9a-f]{3,8}/i);
      }
    }
  });

  it("keeps the panel colour last, as the background-color of the shorthand", () => {
    const out = composePanelBackground("#0E1B35", "brushed");
    expect(out.endsWith("#0E1B35")).toBe(true);
  });
});

describe("the catalogue", () => {
  it("ships all eight, each in a real family", () => {
    expect(CARD_FINISHES).toHaveLength(8);
    const families = new Set(FINISH_FAMILIES.map((f) => f.id));
    for (const f of CARD_FINISHES) expect(families.has(f.family)).toBe(true);
  });

  it("has unique ids and Flat first", () => {
    const ids = CARD_FINISHES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("flat");
  });

  it("gives Free three finishes, including the default", () => {
    expect(FREE_FINISH_IDS).toEqual(["flat", "sheen", "halo"]);
    expect(isFreeFinish(DEFAULT_FINISH)).toBe(true);
    expect(isFreeFinish("brushed")).toBe(false);
    // An unknown id must read as free — it resolves to Flat, and treating it as
    // Pro would strip a card that is already showing its default look.
    expect(isFreeFinish("nonsense")).toBe(true);
  });

  it("marks the one finish that lightens the panel", () => {
    expect(getFinish("frosted").lightens).toBe(true);
    expect(CARD_FINISHES.filter((f) => f.lightens).map((f) => f.id)).toEqual(["frosted"]);
  });
});

describe("a media URL can never break out of the url() token", () => {
  // The value comes from owner-supplied customization JSON and lands inside a
  // style attribute. A url() token ends at the first unescaped quote.
  it("accepts ordinary paths and http(s) URLs, hyphens and query strings included", () => {
    expect(cssUrl("/uploads/my-bg-2.png")).toBe("/uploads/my-bg-2.png");
    expect(cssUrl("https://cdn.example.com/a-b_c.jpg?v=2")).toBe("https://cdn.example.com/a-b_c.jpg?v=2");
  });

  it("refuses every scheme that is not http(s) or a same-origin path", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "vbscript:x", "file:///etc/passwd", "  "]) {
      expect(cssUrl(bad), bad).toBeNull();
    }
  });

  it("escapes the quote and backslash that would close the token", () => {
    expect(cssUrl('/a").y{}')).toBe('/a\\").y{}');
    expect(cssUrl("/a\\b.png")).toBe("/a\\\\b.png");
  });

  it("drops a rejected URL rather than painting a broken layer", () => {
    expect(composePanelBackground("#0E1B35", "flat", { url: "javascript:x" })).toBe("#0E1B35");
  });
});

describe("panel media", () => {
  it("layers the scrim above the photo and the photo above the colour", () => {
    const out = composePanelBackground("#0E1B35", "flat", { url: "/u/b.jpg", dim: 0.4 });
    const scrim = out.indexOf("rgba(0,0,0,0.4)");
    const photo = out.indexOf('url("/u/b.jpg")');
    const colour = out.indexOf("#0E1B35");
    expect(scrim).toBeGreaterThan(-1);
    expect(scrim).toBeLessThan(photo);
    expect(photo).toBeLessThan(colour);
  });

  it("clamps the scrim so a card can never be dimmed to a black rectangle", () => {
    expect(composePanelBackground("#000", "flat", { url: "/u/b.jpg", dim: 9 })).toContain("rgba(0,0,0,0.85)");
    expect(composePanelBackground("#000", "flat", { url: "/u/b.jpg", dim: -3 })).not.toContain("rgba(0,0,0,");
  });

  it("paints a VIDEO's poster, because CSS cannot play one", () => {
    const s = templateStyle({
      customization: { panelMedia: "/u/clip.mp4", panelMediaType: "video", panelMediaPoster: "/u/still.jpg" },
    });
    const out = panelBackground(s, "#111");
    expect(out).toContain('url("/u/still.jpg")');
    expect(out).not.toContain("clip.mp4");
  });

  it("paints an IMAGE directly", () => {
    const s = templateStyle({ customization: { panelMedia: "/u/b.jpg", panelMediaType: "image" } });
    expect(panelBackground(s, "#111")).toContain('url("/u/b.jpg")');
  });
});

describe("it reaches all six templates without touching one of them", () => {
  const TEMPLATES = ["ClassicPro", "ModernBold", "PhotoFirst", "LocalBusiness", "LuxuryMinimal", "LogoFirst"];

  it("every template resolves its panel through panelBackground", () => {
    for (const t of TEMPLATES) {
      const src = read(`src/components/card-templates/${t}.tsx`);
      expect(src, `${t} still resolves its panel inline`).toMatch(/panelBackground\(style,/);
      // The old inline form must be gone, or a finish silently does nothing on
      // that template while appearing to be set.
      expect(src, `${t} still has a raw style.bgColor ?? fallback`).not.toMatch(/style\.bgColor \?\?/);
    }
  });
});

describe("the plan line", () => {
  it("strips a Pro finish and all panel media for a non-paid account", () => {
    const src = read("src/lib/plan.ts");
    expect(src).toMatch(/if \(finish !== undefined && !isFreeFinish\(finish\)\) delete cust\.finish;/);
    for (const k of ["panelMedia", "panelMediaType", "panelMediaPoster", "panelDim"]) {
      expect(src, `${k} is not stripped for Free`).toMatch(new RegExp(`delete cust\\.${k};`));
    }
  });

  it("the office look reads every key the Branding page can now set", () => {
    // OfficeBranding renders the card editor's own TemplateStyleControls, so a
    // key missing from its reader is a control that saves nothing.
    const src = read("src/components/OfficeBranding.tsx");
    for (const k of ["finish", "panelMedia", "panelMediaType", "panelMediaPoster", "panelDim"]) {
      expect(src, `OfficeBranding does not read ${k}`).toContain(k);
    }
  });
});

describe("the downloaded card still shows the panel photo", () => {
  it("ShareCardCapture proxies panel media into the canvas", () => {
    // A cross-origin image taints the canvas and the whole capture comes back
    // blank — the same reason photoUrl and logoUrl are already proxied.
    const src = read("src/components/ShareCardCapture.tsx");
    expect(src).toMatch(/panelMedia: proxy\(/);
    expect(src).toMatch(/panelMediaPoster: proxy\(/);
  });
});

// ── The bug this file exists to prevent from coming back ─────────────────────
//
// TemplateStyleControls is SHARED by the Add wizard, the card Editor and the
// Office Branding page. Add a key to TemplateStyle and the control appears in
// all three for free — but each of those screens builds its own state object and
// its own save payload from a HARDCODED list of keys. Miss one and you ship a
// picker that renders, opens blank, and silently forgets what it is told. That
// is exactly what happened here on the first pass, in the editor.
describe("every TemplateStyle key survives a round trip in both flows", () => {
  const KEYS = ["finish", "panelMedia", "panelMediaType", "panelMediaPoster", "panelDim"];

  it("the card editor reads each key into state and writes it back on save", () => {
    const src = read("src/app/cards/[id]/edit/CardEditForm.tsx");
    const load = src.slice(src.indexOf("const [templateStyleState"), src.indexOf("function patchTemplateStyle"));
    for (const k of KEYS) {
      expect(load, `the editor never loads ${k}`).toContain(`${k}:`);
      expect(src, `the editor never saves ${k}`).toMatch(new RegExp(`${k}: templateStyleState\\.${k}`));
    }
  });

  it("the wizard carries them through its Free-plan conversion", () => {
    // The wizard SAVES by spreading templateStyleState, so it needs nothing per
    // key — but this one path rebuilds the object field by field.
    const src = read("src/app/cards/new/NewCardWizard.tsx");
    const conv = src.slice(src.indexOf("function applyFreeDesignConversion"), src.indexOf("function handleAuthedFirstCardFree"));
    for (const k of KEYS) {
      expect(conv, `the Free conversion drops ${k}`).toContain(`${k}:`);
    }
    // And it must read from the CONVERTED customization, never the draft, or a
    // Pro finish goes straight back onto a card the server will strip.
    expect(conv).toMatch(/finish: result\.customization\.finish/);
  });

  it("the stored shape declares them, so the compiler catches the next one", () => {
    const types = read("src/components/card-templates/types.tsx");
    for (const k of KEYS) expect(types, `CardCustomization is missing ${k}`).toContain(`${k}?:`);
  });
});
