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
    "Pro feature — You've used your 5 free leads this month. Unlimited leads are only available on the Pro plan on swiftcard.me";
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
    // Compared against the rendered TEXT, not the raw markup: PlanNotice wraps
    // "on swiftcard.me" in a nowrap span so the domain can't be orphaned onto
    // a line of its own, which splits the sentence across elements. What must
    // stay exact is what the user reads.
    expect(out.replace(/<[^>]+>/g, "")).toContain(NATIVE_COPY);
  });

  it("contains no link, no button, no price, and no 'upgrade' verb", () => {
    expect(out).not.toMatch(/<a[\s>]/i);
    expect(out).not.toMatch(/<button/i);
    expect(out).not.toMatch(/href=/i);
    expect(out).not.toMatch(/\$\d/);
    // "upgrade" must not appear anywhere in the native output.
    expect(out).not.toMatch(/upgrade/i);
    expect(out).not.toMatch(/pricing/i);
  });

  // The domain used to be banned outright here. It is now named on purpose
  // (owner decision, 2026-08-12): a Free user hitting a locked feature in the
  // app had no way to learn where the plan lives. What has NOT changed is that
  // it must stay inert — the notice may say the word, never offer the tap.
  //
  // Apple's 3.1.1 anti-steering rules are the reason the shape matters this
  // much: a static sentence is a far weaker claim than a link or a button, and
  // this test is what stops the sentence quietly becoming one.
  it("names the site as plain text — never as a link or a tappable element", () => {
    expect(out.replace(/<[^>]+>/g, "")).toContain("swiftcard.me");
    // Not inside an anchor, and not carrying a URL scheme or a path.
    expect(out).not.toMatch(/<a[\s>]/i);
    expect(out).not.toMatch(/href=/i);
    expect(out).not.toMatch(/https?:\/\//i);
    expect(out).not.toMatch(/swiftcard\.me\//);
    expect(out).not.toMatch(/onclick/i);
    // No role that would announce it as actionable to assistive tech.
    expect(out).not.toMatch(/role="(link|button)"/i);
  });

  it("renders a plain PRO / OFFICE text badge", () => {
    expect(renderToStaticMarkup(h(PlanBadge, { tier: "pro" as const }))).toContain("PRO");
    expect(renderToStaticMarkup(h(PlanBadge, { tier: "office" as const }))).toContain("OFFICE");
  });
});

// The extension point this file used to assert was DOCUMENTED-BUT-UNBUILT is
// now built: App Review rejected 1.0.0 (3) under Guideline 3.1.1 precisely
// because the app unlocked paid content with no way to buy it. The inert notice
// was the violation, not the safeguard. What still needs pinning is the part
// that keeps the remedy compliant.
describe("the external purchase link is wired and leaves the app", () => {
  const gate = read("src/components/PlanGate.tsx");
  const button = read("src/components/ExternalPurchaseButton.tsx");
  const lib = read("src/lib/external-purchase.ts");

  it("PlanNotice renders the purchase button", () => {
    expect(gate).toMatch(/<ExternalPurchaseButton/);
  });

  it("the button is a <button>, never an anchor to swiftcard.me", () => {
    // An <a href="https://swiftcard.me/..."> is caught by allowNavigation in
    // capacitor.config.ts and navigates INSIDE the webview — which is not
    // "linking out to the default browser" and would fail review again.
    expect(button).toMatch(/<button/);
    expect(button, "an anchor here would stay inside the webview").not.toMatch(
      /<a\s[^>]*href=["'{]?https?:\/\/swiftcard\.me/,
    );
  });

  it("the web half fails closed when the native plugin is missing", () => {
    // No plugin → no button. A fallback to window.open/Browser.open would look
    // compliant while staying in-app, and would also ship the link to
    // storefronts where a link-out is not permitted.
    expect(lib).toMatch(/canOfferExternalPurchase/);
    expect(lib).toMatch(/if \(!p\) return false/);
    expect(button).toMatch(/if \(!available\) return null/);
    // Comments stripped first: this file's header explains at length why
    // window.open and @capacitor/browser are the WRONG tools here, and an
    // unstripped match would fire on that explanation.
    const code = lib.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code, "must not fall back to an in-webview open").not.toMatch(
      /window\.open|@capacitor\/browser/,
    );
  });

  it("the US-storefront-only constraint is recorded where someone will see it", () => {
    expect(gate).toMatch(/US[- ]STOREFRONT[- ]ONLY|US storefront only/i);
  });
});
