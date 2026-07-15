import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PlanGate, PlanNotice, PlanBadge } from "@/components/PlanGate";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// In the Node/SSR render path (no window, useEffect does not run),
// useIsNativeApp() resolves false — so PlanGate takes the WEB branch and
// renders children verbatim. This mirrors both the server render and the first
// client paint on every platform.

describe("PlanGate web branch renders children byte-for-byte", () => {
  it("passes today's web UI straight through, unchanged", () => {
    const web = h("div", { className: "banner" }, "Upgrade to Pro →");
    const out = renderToStaticMarkup(
      h(PlanGate, { feature: "demo", nativeCopy: "Pro feature — demo." }, web)
    );
    expect(out).toBe('<div class="banner">Upgrade to Pro →</div>');
  });

  // Lock the exact web strings for 3 real call sites the gate wraps in step 3.
  // If a future refactor changes the web copy, PlanGate still emits it verbatim
  // (it just forwards children), so these guard the strings at the source.
  const CALL_SITE_STRINGS: Array<[string, string]> = [
    // Second card (dashboard)
    ["Ready for a second card? Go unlimited with Pro.", "second-card"],
    // Second card CTA (dashboard)
    ["Upgrade to Pro →", "second-card-cta"],
    // Custom designer tile (CustomDesignCard)
    ["Make it unmistakably yours — unlock the custom designer with Pro →", "custom-designer"],
  ];

  for (const [str, key] of CALL_SITE_STRINGS) {
    it(`web branch preserves the exact "${key}" string`, () => {
      const out = renderToStaticMarkup(
        h(PlanGate, { feature: key, nativeCopy: "Pro feature — x." }, h("span", null, str))
      );
      expect(out).toContain(str);
    });
  }
});

describe("PlanGate native notice is neutral — no selling", () => {
  const NATIVE_COPY =
    "Pro feature — You've used your 5 free leads this month. Unlimited leads are only available on the Pro plan.";
  const rawOut = renderToStaticMarkup(h(PlanNotice, { tier: "pro" as const, copy: NATIVE_COPY }));
  // React escapes text nodes for HTML; decode the entities React emits so we can
  // compare against the exact human copy string.
  const decode = (s: string) =>
    s
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
  const out = decode(rawOut);

  it("shows the exact neutral copy", () => {
    expect(out).toContain(NATIVE_COPY);
  });

  it("contains no link, no button, no price, no 'upgrade' verb, no website", () => {
    expect(out).not.toMatch(/<a[\s>]/i);
    expect(out).not.toMatch(/<button/i);
    expect(out).not.toMatch(/href=/i);
    expect(out).not.toMatch(/\$\d/);
    // "upgrade" must not appear anywhere in the native output.
    expect(out).not.toMatch(/upgrade/i);
    expect(out).not.toMatch(/pricing/i);
    expect(out).not.toMatch(/swiftcard\.me|\/pricing|website/i);
  });

  it("renders a plain PRO / OFFICE text badge", () => {
    expect(renderToStaticMarkup(h(PlanBadge, { tier: "pro" as const }))).toContain("PRO");
    expect(renderToStaticMarkup(h(PlanBadge, { tier: "office" as const }))).toContain("OFFICE");
  });
});

describe("PlanGate keeps the documented future extension point", () => {
  const src = read("src/components/PlanGate.tsx");
  it("documents the US-only external-purchase extension point without implementing it", () => {
    expect(src).toMatch(/FUTURE EXTENSION POINT/);
    expect(src).toMatch(/External Purchase Link|external.purchase/i);
    expect(src).toMatch(/Nothing renders here today/i);
  });
});
