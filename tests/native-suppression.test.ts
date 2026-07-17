import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import NativeHidden from "@/components/NativeHidden";
import UpgradeButton from "@/components/UpgradeButton";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Area 6 — native selling suppression. In the Node/SSR render path
// (useIsNativeApp resolves false, matching web + first client paint) every gated
// surface still renders its web content unchanged. The native branch (hidden)
// is locked via source assertions, since it only activates client-side in the
// Capacitor shell.

describe("web render is unchanged (native false in SSR)", () => {
  it("NativeHidden renders its children on web", () => {
    const out = renderToStaticMarkup(h(NativeHidden, null, h("span", null, "web-only")));
    expect(out).toBe("<span>web-only</span>");
  });

  it("UpgradeButton still renders the price CTA on web", () => {
    const out = renderToStaticMarkup(h(UpgradeButton, {}));
    expect(out).toContain("Upgrade ·");
    expect(out).toMatch(/\$\d/); // the price is present on web
  });
});

type Guard = { file: string; patterns: RegExp[] };

const GUARDS: Guard[] = [
  { file: "src/components/NativeHidden.tsx", patterns: [/if \(native\) return null/] },
  {
    file: "src/components/UpgradeButton.tsx",
    patterns: [/useIsNativeApp/, /if \(native\) return null/],
  },
  {
    file: "src/app/upgrade/UpgradeClient.tsx",
    patterns: [/detectNativeApp\(\)/, /router\.replace\("\/dashboard"\)/],
  },
  {
    file: "src/components/site/SiteNav.tsx",
    patterns: [/useIsNativeApp/, /\{!native && <Link href="\/pricing"/],
  },
  {
    file: "src/components/site/SiteFooter.tsx",
    patterns: [/NativeHidden/, /l\.href === "\/pricing"/],
  },
  {
    file: "src/components/SettingsShell.tsx",
    patterns: [/hideOnNative/, /native && s\.hideOnNative/],
  },
  {
    file: "src/app/settings/flows/page.tsx",
    patterns: [/hideOnNative: true/, /<NativeHidden>/, /data-tour="settings-refer"/],
  },
  { file: "src/components/ReferAFriend.tsx", patterns: [/if \(native\) return null/] },
  { file: "src/components/FirstLeadNudge.tsx", patterns: [/if \(!show \|\| native\) return null/] },
  { file: "src/components/GrowShare.tsx", patterns: [/native\s*\n?\s*\?/, /help more people discover SwiftCard/] },
  { file: "src/app/grow/page.tsx", patterns: [/<NativeHidden>/] },
  {
    file: "src/components/NotificationsPanel.tsx",
    patterns: [/isNative && n\.type === "referral_claim"/],
  },
  {
    file: "src/components/HelpWidget.tsx",
    patterns: [/NATIVE_GREETING/, /NATIVE_SUGGESTIONS/, /native: isNativeApp/],
  },
  { file: "src/components/SignupNudgeHost.tsx", patterns: [/if \(!source \|\| native\) return null/] },
  { file: "src/components/AppStorePopup.tsx", patterns: [/if \(!open \|\| native\) return null/] },
  {
    // Web push can't work inside the Capacitor WKWebView, and the web fallback
    // ("Add to Home Screen") is impossible instructions inside a native app.
    // Native must short-circuit to its own honest not-available state.
    file: "src/components/EnablePushButton.tsx",
    patterns: [/detectNativeApp\(\)/, /state === "native"/, /native: true/],
  },
  // ── App Store 3.1.1 leak fixes (overnight iOS review audit) ────────────────
  // Dashboard trial banner: status info may stay, the "Keep Pro →" /pricing CTA
  // must not render on native.
  { file: "src/components/TrialBanner.tsx", patterns: [/useIsNativeApp/, /\{!native && \(/] },
  // The shared plan chooser (welcome + card-wizard guest step): native gets ONLY
  // the free continue action — no prices, no paid plans, no checkout.
  { file: "src/components/PlanCards.tsx", patterns: [/useIsNativeApp/, /if \(native\) \{/] },
  // /checkout order summary + Stripe hand-off: client redirect on native, same
  // pattern as /pricing and /upgrade.
  { file: "src/app/checkout/CheckoutClient.tsx", patterns: [/detectNativeApp\(\)\) router\.replace\("\/dashboard"\)/] },
  // /welcome: a stored paid-plan intent must never resume its checkout panel
  // inside the shell.
  { file: "src/components/WelcomePlan.tsx", patterns: [/detectNativeApp\(\) \? null : consumePlanIntent\(\)/] },
  // Office team invite: the one-tap prorated seat PURCHASE (price, charge-today,
  // Stripe seats API) never renders on native; fallback copy is neutral.
  {
    file: "src/components/office/TeamActions.tsx",
    patterns: [/useIsNativeApp/, /!native && canManageSeats && seatInfo\?\.billable && seatPrice/, /Remove an existing team member to free up a seat/],
  },
  // Marketing sales assistant discusses pricing: gated internally AND at its
  // render site.
  { file: "src/components/site/SalesChat.tsx", patterns: [/if \(native\) return null/] },
  { file: "src/components/site/SiteFooter.tsx", patterns: [/<NativeHidden><SalesChat \/><\/NativeHidden>/] },
  // Latent ungated seat purchase (dead code today) — must stay gated if revived.
  { file: "src/components/AddSeatButton.tsx", patterns: [/if \(native\) return null/] },
  // Raw marketing "See pricing"/"Pricing" links wrapped in NativeHidden.
  { file: "src/app/page.tsx", patterns: [/<NativeHidden><Link href="\/pricing"/] },
  { file: "src/app/products/[slug]/page.tsx", patterns: [/<NativeHidden><Link href="\/pricing"/] },
  { file: "src/app/testimonials/page.tsx", patterns: [/<NativeHidden><Link href="\/pricing"/] },
  { file: "src/app/compare/page.tsx", patterns: [/<NativeHidden><Link href="\/pricing"/] },
  { file: "src/app/privacy/page.tsx", patterns: [/<NativeHidden><Link href="\/pricing"/] },
];

describe("native suppression guards are present at each site", () => {
  for (const g of GUARDS) {
    const src = read(g.file);
    for (const p of g.patterns) {
      it(`${g.file} matches ${p}`, () => {
        expect(src).toMatch(p);
      });
    }
  }
});

describe("HelpWidget native greeting/suggestions drop the upgrade prompt", () => {
  const src = read("src/components/HelpWidget.tsx");
  it("NATIVE_GREETING contains no 'upgrade to Pro' prompt", () => {
    const m = src.match(/const NATIVE_GREETING: Msg = \{[\s\S]*?\};/);
    expect(m).not.toBeNull();
    expect((m as RegExpMatchArray)[0]).not.toMatch(/upgrade to Pro/i);
  });
  it("web GREETING is unchanged and still mentions the upgrade example", () => {
    const m = src.match(/const GREETING: Msg = \{[\s\S]*?\};/);
    expect((m as RegExpMatchArray)[0]).toMatch(/How do I upgrade to Pro\?/);
  });
  it("NATIVE_SUGGESTIONS is derived by filtering out the upgrade question", () => {
    expect(src).toMatch(/NATIVE_SUGGESTIONS = SUGGESTIONS\.filter\(\(s\) => s !== "How do I upgrade to Pro\?"\)/);
  });
});
