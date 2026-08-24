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

// Purchase-path history, each posture pinned by a rejection: 1.0.0 (3) inert
// notice → rejected (no way to buy). 1.0.0 (7) external link to the default
// browser → rejected (App Review requires IAP under 3.1.3(b), US link-out
// allowance notwithstanding). Now the notice sells via In-App Purchase, and
// what needs pinning is that the paywall is the ONLY purchase surface and the
// link-out era cannot silently resurface.
describe("the purchase path is In-App Purchase, wired through PlanNotice", () => {
  const gate = read("src/components/PlanGate.tsx");
  const paywall = read("src/components/NativePaywall.tsx");
  const lib = read("src/lib/iap.ts");

  it("PlanNotice renders the IAP subscribe button, not the old link-out", () => {
    expect(gate).toMatch(/<IapSubscribeButton/);
    expect(gate).not.toMatch(/<ExternalPurchaseButton/);
  });

  it("the paywall fails closed at every layer", () => {
    // No native bridge / no RC key / no StoreKit products → no purchase UI.
    // A paywall that renders without live products would show stale or
    // invented prices — 3.1.2 metadata drift by construction.
    expect(lib).toMatch(/if \(!detectNativeApp\(\)\) return null/);
    expect(lib).toMatch(/NEXT_PUBLIC_RC_APPLE_API_KEY\) return null/);
    expect(paywall).toMatch(/if \(!available\) return null/);
  });

  it("purchases identify as the Supabase uid before any purchase", () => {
    // The RevenueCat app_user_id is what maps a purchase to a profile row in
    // the webhook; an anonymous purchase would grant Pro to nobody.
    expect(paywall).toMatch(/getUser\(\)/);
    expect(paywall).toMatch(/ensureIapConfigured\(user\.id\)/);
  });
});
