import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  hostLabel, faviconFor, monogramFor, monogramTint,
  safeAccent, inkOn, fullHref, brandBackground, DEFAULT_ACCENT,
} from "@/lib/link-brand";
import { META, ACCENT_PRESETS } from "@/lib/template-style-presets";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("hostLabel", () => {
  it("strips scheme, www and path", () => {
    expect(hostLabel("https://www.LevLevEducationalFund.Org/donate")).toBe("levleveducationalfund.org");
  });
  it("copes with a schemeless URL, which is what owners type", () => {
    expect(hostLabel("levleveducationalfund.org/apply")).toBe("levleveducationalfund.org");
  });
  it("returns empty for junk instead of throwing", () => {
    expect(hostLabel("")).toBe("");
    expect(hostLabel("   ")).toBe("");
    expect(hostLabel("http://")).toBe("");
  });
});

describe("safeAccent — the guard that keeps the primary button visible", () => {
  it("keeps a normal accent", () => {
    expect(safeAccent("#1D4ED8")).toBe("#1D4ED8");
    expect(safeAccent("#a78bfa")).toBe("#a78bfa");
  });

  it("rejects near-white, which is a REAL saved value", () => {
    // modern-bold's presets include "#ffffff" and plan.ts snaps a Free card's
    // accent onto that list, so without this the plate is white-on-white.
    expect(safeAccent("#ffffff")).toBe(DEFAULT_ACCENT);
    expect(safeAccent("#fefefe")).toBe(DEFAULT_ACCENT);
  });

  it("falls back on missing or malformed input", () => {
    expect(safeAccent(undefined)).toBe(DEFAULT_ACCENT);
    expect(safeAccent(null)).toBe(DEFAULT_ACCENT);
    expect(safeAccent("")).toBe(DEFAULT_ACCENT);
    expect(safeAccent("rebeccapurple")).toBe(DEFAULT_ACCENT);
    expect(safeAccent("#abc")).toBe(DEFAULT_ACCENT);
  });

  it("EVERY accent preset in the app produces a legible plate", () => {
    // The real contract: for each preset a card can actually hold, the fill
    // safeAccent returns must carry inkOn()'s chosen ink at a readable contrast.
    const presets = new Set<string>(ACCENT_PRESETS);
    for (const meta of Object.values(META)) {
      for (const p of meta.accent?.presets ?? []) presets.add(p);
    }
    // Includes "#ffffff" — the value that makes this test matter.
    expect(presets.has("#ffffff"), "the near-white preset is gone; re-check the guard").toBe(true);
    expect(presets.size).toBeGreaterThan(8);
    for (const p of presets) {
      const fill = safeAccent(p);
      const ink = inkOn(fill);
      expect(["#FFFFFF", "#0F172A"]).toContain(ink);
      // Never a white plate with white ink.
      expect(fill.toLowerCase(), `${p} stayed near-white`).not.toBe("#ffffff");
    }
  });

  it("amber keeps DARK ink, not white", () => {
    // #fbbf24 is a real preset; its YIQ is ~191, comfortably light.
    expect(safeAccent("#fbbf24")).toBe("#fbbf24");
    expect(inkOn("#fbbf24")).toBe("#0F172A");
  });

  it("a deep accent gets white ink", () => {
    expect(inkOn("#1D4ED8")).toBe("#FFFFFF");
    expect(inkOn("#010101")).toBe("#FFFFFF");
  });
});

describe("monogram", () => {
  it("is the first letter of the host, uppercased", () => {
    expect(monogramFor("https://levleveducationalfund.org/donate")).toBe("L");
    expect(monogramFor("https://www.example.com")).toBe("E");
  });
  it("never returns empty", () => {
    expect(monogramFor("")).toBe("?");
  });
  it("is tinted by HOSTNAME, so reordering links never reshuffles colours", () => {
    const a = monogramTint("https://example.com/one");
    const b = monogramTint("https://example.com/two");
    expect(a).toBe(b);
  });
  it("different hosts generally get different tints", () => {
    const tints = new Set(
      ["a.com", "b.org", "c.net", "d.io", "example.com", "swiftcard.me"].map((h) => monogramTint(`https://${h}`)),
    );
    expect(tints.size).toBeGreaterThan(1);
  });
});

describe("faviconFor", () => {
  it("is derived from the hostname — no scrape, no /api/link-preview", () => {
    expect(faviconFor("https://levleveducationalfund.org/donate"))
      .toBe("https://www.google.com/s2/favicons?domain=levleveducationalfund.org&sz=128");
  });
  it("returns null for junk", () => {
    expect(faviconFor("")).toBeNull();
  });
});

describe("fullHref matches the rule the old component used", () => {
  it("leaves absolute URLs alone", () => {
    expect(fullHref("https://x.test/a")).toBe("https://x.test/a");
  });
  it("adds https to a bare domain", () => {
    expect(fullHref("x.test/a")).toBe("https://x.test/a");
  });
  it("neutralises a hostile scheme", () => {
    expect(fullHref("javascript:alert(1)")).toBe("https://alert(1)");
    expect(fullHref("")).toBe("#");
  });
});

describe("brandBackground is shared, so the two surfaces can't disagree", () => {
  it("Instagram is the gradient on both", () => {
    expect(brandBackground("Instagram", "#E1306C")).toContain("radial-gradient");
  });
  it("everything else is its flat brand colour", () => {
    expect(brandBackground("LinkedIn", "#0A66C2")).toBe("#0A66C2");
  });
  it("SocialIcons imports it rather than keeping a copy", () => {
    const c = code("src/components/SocialIcons.tsx");
    expect(c, "SocialIcons re-declared brandBackground").not.toMatch(/function brandBackground/);
    expect(c).toMatch(/from "@\/lib\/link-brand"/);
  });
});

describe("the rail is opt-in, so nothing else changed", () => {
  const MOCKUPS = [
    "src/components/site/LeadCapturePhone.tsx",
    "src/components/site/SignatureDemo.tsx",
    "src/components/site/TemplateGallery.tsx",
  ];

  it('SocialLinkIntercept still defaults to the original "bars"', () => {
    expect(code("src/components/SocialLinkIntercept.tsx")).toMatch(/variant = "bars"/);
  });

  it("the three marketing mockups never opt in", () => {
    // They render this component inside a narrow phone frame on the homepage.
    // A 40px disc rail there would be a silent visual regression on marketing.
    for (const f of MOCKUPS) {
      const c = code(f);
      expect(c, `${f} does not render SocialLinkIntercept any more — re-check this test`).toMatch(/SocialLinkIntercept/);
      expect(c, `${f} opted into the rail`).not.toMatch(/variant=/);
    }
  });

  it("only the public card page opts in", () => {
    expect(code("src/app/card/[username]/page.tsx")).toMatch(/variant="rail"/);
  });

  it("the intercept mechanic is intact in every rail branch", () => {
    const c = code("src/components/SocialLinkIntercept.tsx");
    // Three anchors in the rail (website, solo social, disc) + one in bars.
    expect((c.match(/onClick=\{\(e\) => handleClick\(/g) ?? []).length).toBe(4);
    // Never a <button> — alreadyShared relies on native navigation.
    expect((c.match(/target=\{alreadyShared \? "_blank" : undefined\}/g) ?? []).length).toBe(4);
    // The capture path itself is untouched.
    expect(c).toMatch(/source: `social_intercept_\$\{pendingLabel/);
    expect(c).toMatch(/sms_consent: smsConsent/);
    expect(c).toMatch(/markSharedWith\(cardOwner, form\)/);
  });

  it("the signup nudge still fires on every action link", () => {
    const c = code("src/components/CardActionLinks.tsx");
    expect((c.match(/triggerSignupNudge\("link_button"\)/g) ?? []).length).toBe(2); // feature + stack rows
  });
});

describe("the section costs no first-party network", () => {
  it("neither new component calls /api/link-preview", () => {
    for (const f of ["src/components/LinkMark.tsx", "src/components/CardActionLinks.tsx"]) {
      expect(code(f), `${f} fetches a preview`).not.toMatch(/link-preview|fetch\(/);
    }
  });

  it("the favicon is lazy and never leaves an empty box", () => {
    const c = code("src/components/LinkMark.tsx");
    expect(c).toMatch(/loading="lazy"/);
    // The monogram is painted underneath and only fades out once the image loads.
    expect(c).toMatch(/opacity: showFavicon \? 0 : 1/);
    expect(c).toMatch(/onError=\{\(\) => setFailed\(true\)\}/);
  });
});
