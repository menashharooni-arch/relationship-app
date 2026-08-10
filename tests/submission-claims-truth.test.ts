import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

// Everything a reviewer is told the app does, they will try. A feature that is
// described but absent is a Guideline 2.1 rejection; a description that
// oversells is 2.3. This file exists because Apple Wallet was promised in the
// App Store description, the reviewer notes, and the watchOS justification
// while `/api/wallet/pass` returned 501 not_configured in production and no
// APPLE_PASS_* env vars had ever been set. The button was correctly gated, so
// nothing looked broken locally — the claim was the only broken part.
describe("submission copy only claims features that are actually configured", () => {
  const notes = read("app-store/APP_REVIEW_NOTES.md");
  const description = read("docs/ios-review/APP-STORE-METADATA.md");
  const testPlan = read("app-store/TESTFLIGHT_TEST_PLAN.md");

  // Wallet needs all five of these at runtime (src/lib/wallet-config.ts).
  // If someone turns Wallet on, they must set them in Vercel AND update this
  // test's expectations in the same change — that is the point.
  it("wallet-config still requires the env vars this test reasons about", () => {
    const cfg = read("src/lib/wallet-config.ts");
    for (const v of [
      "APPLE_PASS_TYPE_ID",
      "APPLE_TEAM_ID",
      "APPLE_PASS_CERT_PEM",
      "APPLE_PASS_KEY_PEM",
      "APPLE_WWDR_PEM",
    ]) {
      expect(cfg).toContain(v);
    }
  });

  it("the Add to Wallet button stays gated behind hasWalletConfig()", () => {
    // The gate is what keeps an unconfigured Wallet from rendering a button
    // that errors. Losing it is worse than the copy problem.
    expect(read("src/app/dashboard/page.tsx")).toMatch(
      /walletEnabled\s*&&\s*<AddToWalletButton/
    );
    expect(read("src/app/dashboard/page.tsx")).toContain("hasWalletConfig()");
  });

  it("reviewer notes do not tell the reviewer to test Apple Wallet", () => {
    expect(notes).not.toMatch(/Add to Apple Wallet/i);
    expect(notes).not.toMatch(/Share → QR \/ Wallet/i);
  });

  it("the App Store description does not promise Apple Wallet", () => {
    const body = description.slice(description.indexOf("## Description"));
    expect(body).not.toMatch(/Apple Wallet/i);
  });

  it("the TestFlight plan does not ask a tester to verify Wallet", () => {
    // Skipped/struck-through mentions are fine; an open checkbox is not.
    expect(testPlan).not.toMatch(/^- \[ \] Apple Wallet/m);
  });

  // The watchOS story used to rest entirely on "the Wallet pass syncs to Watch
  // Wallet". With Wallet off, that justification is false too.
  it("the watchOS limitation does not justify itself with Wallet", () => {
    const limits = read("app-store/KNOWN_LIMITATIONS.md");
    const watchRow = limits.split("\n").find((l) => l.includes("watchOS app")) ?? "";
    expect(watchRow).not.toMatch(/Wallet pass syncs to Watch Wallet \(real today\)/);
  });
});

// App Store Connect attaches a build to the version record whose string matches
// CFBundleShortVersionString exactly, and it rejects an upload outright when an
// embedded extension's version differs from its host app's. Both are silent
// until the moment you try to ship.
describe("version numbers line up for upload", () => {
  const proj = read("ios/App/App.xcodeproj/project.pbxproj");
  const metadata = read("docs/ios-review/APP-STORE-METADATA.md");

  it("every target builds the version the metadata promises", () => {
    const documented = metadata.match(/^- (\d+\.\d+\.\d+), build (\d+)\./m);
    expect(documented, "APP-STORE-METADATA.md ## Version line").not.toBeNull();
    const [, version, build] = documented!;

    const marketing = [...proj.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1]);
    const current = [...proj.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((m) => m[1]);
    // App Debug/Release + widget Debug/Release
    expect(marketing).toHaveLength(4);
    expect(current).toHaveLength(4);
    expect(new Set(marketing)).toEqual(new Set([version]));
    expect(new Set(current)).toEqual(new Set([build]));
  });

  it("the widget inherits its version instead of hardcoding one", () => {
    // Hardcoding here is how app and extension drift apart between releases.
    const plist = read("ios/App/SwiftCardWidget/Info.plist");
    expect(plist).toContain("$(MARKETING_VERSION)");
    expect(plist).toContain("$(CURRENT_PROJECT_VERSION)");
  });
});
