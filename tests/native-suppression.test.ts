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
