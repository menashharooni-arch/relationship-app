import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  hostLabel, faviconFor, monogramFor, monogramTint,
  fullHref, brandBackground,
} from "@/lib/link-brand";

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

describe("every action link is the same quiet row", () => {
  const c = () => code("src/components/CardActionLinks.tsx");

  it("no link is singled out — no feature/rest split", () => {
    // The first link used to be an accent-filled plate. Dropped on owner call:
    // a saturated button reads as advertising on a professional's card.
    expect(c(), "the feature/rest split is back").not.toMatch(/const \[feature, \.\.\.rest\]/);
    expect(c()).toMatch(/links\.map\(/);
  });

  it("nothing on this surface reads the card's accent colour", () => {
    // Not just here — the section as a whole is free of saturated blocks now.
    for (const f of ["src/components/CardActionLinks.tsx", "src/components/SocialLinkIntercept.tsx"]) {
      expect(code(f), `${f} still fills something with the accent`).not.toMatch(/safeAccent|inkOn|color-mix/);
    }
    expect(code("src/app/card/[username]/page.tsx"), "the page still passes an accent down")
      .not.toMatch(/accent=\{customization\.accentColor\}/);
  });

  it("all rows live in ONE container with internal hairlines", () => {
    // The grouping is the part that survived — N floating slabs read as a pile.
    expect(c()).toMatch(/rounded-\[14px\] overflow-hidden bg-white/);
    expect(c()).toMatch(/border-b border-\[#F1EBE3\] last:border-b-0/);
  });

  it("has a real hover state, plus keyboard focus", () => {
    expect(c()).toMatch(/hover:bg-\[#F2F6FF\]/);
    expect(c()).toMatch(/active:bg-\[#E4ECFE\]/);
    expect(c(), "keyboard users get no visible affordance").toMatch(/focus-visible:/);
  });

  it("every tappable row in the section shares the SAME blue hover", () => {
    // Owner asked for blue. Three row shapes across two files — the links
    // table, the website row/capsule, and the lone-social row — and a
    // mismatch between them is the kind of thing only a side-by-side catches.
    for (const f of ["src/components/CardActionLinks.tsx", "src/components/SocialLinkIntercept.tsx"]) {
      const s = code(f);
      expect(s, `${f} kept a warm hover`).not.toMatch(/hover:bg-\[#FBF9F6\]|active:bg-\[#F4EFE7\]/);
      expect(s).toMatch(/hover:bg-\[#F2F6FF\]/);
    }
    // Every row that hovers also turns its chevron blue.
    const rail = code("src/components/SocialLinkIntercept.tsx");
    expect((rail.match(/group-hover:text-\[#1D4ED8\]/g) ?? []).length).toBe(2);
    expect(code("src/components/CardActionLinks.tsx")).toMatch(/group-hover:text-\[#1D4ED8\]/);
  });

  it("hover changes COLOUR, never position", () => {
    // A row inside a shared container must not move independently or the
    // hairlines visibly break. The chevron may lean; the row may not.
    const rowClass = c().match(/className="group flex items-center gap-3 min-h-\[52px\][^"]*"/)?.[0] ?? "";
    expect(rowClass).toBeTruthy();
    expect(rowClass, "the row itself translates or scales on hover").not.toMatch(/hover:(translate|scale)/);
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
    // One render site now (a single map over all links), so one call covers
    // every row — but it must be INSIDE the map, not on a wrapper.
    const c = code("src/components/CardActionLinks.tsx");
    const map = c.slice(c.indexOf("links.map("));
    expect(map, "the nudge is no longer attached to each row").toMatch(
      /onClick=\{\(\) => triggerSignupNudge\("link_button"\)\}/,
    );
    expect((c.match(/triggerSignupNudge\(/g) ?? []).length).toBe(1);
  });
});

describe("public card page copy and controls", () => {
  const PAGE = "src/app/card/[username]/page.tsx";

  it('the Swift Links chip says "View Swift Link page", not "View all"', () => {
    const c = code(PAGE);
    expect(c).toMatch(/View Swift Link page →/);
    expect(c, "the vague label is back").not.toMatch(/>\s*View all →\s*</);
  });

  it("Share this card no longer offers Show QR Code", () => {
    // A sharer's control sitting in a viewer's flow: it asked the person
    // already holding the card to display a QR for someone ELSE to scan.
    const c = code(PAGE);
    expect(c, "the QR modal is back on the public card").not.toMatch(/<QRCodeModal/);
    expect(c, "an unused import was left behind").not.toMatch(/import QRCodeModal/);
  });

  it("but Share this card still shares", () => {
    // Removing one control must not have taken the box's actual job with it.
    const c = code(PAGE);
    expect(c).toMatch(/<ShareButton/);
    expect(c).toMatch(/label="Share this card"/);
  });

  it("the QR modal itself survives for the surfaces that still use it", () => {
    // Three marketing mockups render it; deleting the component would break
    // the homepage.
    for (const f of [
      "src/components/site/LeadCapturePhone.tsx",
      "src/components/site/SignatureDemo.tsx",
      "src/components/site/TemplateGallery.tsx",
    ]) {
      expect(code(f), `${f} lost its QR modal`).toMatch(/<QRCodeModal/);
    }
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
