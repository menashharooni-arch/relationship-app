import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { externalPurchaseUrl } from "@/lib/external-purchase";

// ── Running out of seats must never be a dead end ────────────────────────────
//
// Owner report 2026-09-06: an Office admin who ran out of seats was told to
// "remove an existing team member", with no way to buy one. On the WEB that was
// already wrong — the one-tap prorated purchase exists. In the iOS shell it was
// the deliberate App Review 3.1.1 fallback, and the fix there is not to sell
// in-app: it is the US-storefront allowance the 1.0.0 rejection itself named,
// "link out to the default browser".
//
// So there are two correct behaviours and they must not be confused:
//   web    → buy the seat in place, with the price and the charge shown.
//   native → NO price, NO charge, a button that LEAVES the app.

const root = process.cwd();
const src = readFileSync(join(root, "src/components/office/TeamActions.tsx"), "utf8");

describe("web: the seat is bought in place", () => {
  it("the purchase panel is web-only and states the real amounts", () => {
    expect(src).toMatch(/!native && canManageSeats && seatInfo\?\.billable && seatPrice/);
    expect(src).toMatch(/Charged today/);
    expect(src).toMatch(/you authorize SwiftCard to charge your card on file/);
  });
});

describe("native: a way forward, without selling in the app", () => {
  it("offers a button that leaves for the default browser", () => {
    expect(src).toMatch(/native && canManageSeats && canLinkOut/);
    expect(src).toMatch(/Add a seat on swiftcard\.me/);
    expect(src).toMatch(/openExternalPurchase\("\/settings\/flows#billing"\)/);
  });

  it("that button NEVER appears without the plugin — fail closed", () => {
    // An older shell has no ExternalPurchase plugin. Rendering the button there
    // would do nothing at all; worse, falling back to an in-webview link would
    // look compliant while being the exact violation that got 1.0.0 rejected.
    expect(src).toMatch(/canOfferExternalPurchase\(\)/);
    expect(src).toMatch(/Remove an existing team member to free up a seat/);
  });

  it("shows no price and no charge anywhere on the native path", () => {
    // Everything money-shaped stays inside the `!native` branch.
    const at = src.indexOf("native && canManageSeats && canLinkOut");
    const block = src.slice(at, src.indexOf("Go back", at));
    expect(block).not.toMatch(/usd\(|seatPrice|Charged today|Pay /);
  });

  it("does not reach the browser by any route that stays inside the app", () => {
    // swiftcard.me is allow-listed in capacitor.config.ts, so an <a>, a
    // window.open and @capacitor/browser all stay in the WKWebView — and the
    // last one merely LOOKS like Safari. Only the plugin leaves.
    const at = src.indexOf("native && canManageSeats && canLinkOut");
    const block = src.slice(at, src.indexOf("Go back", at));
    expect(block).not.toMatch(/window\.open|<a |Browser\.open|target="_blank"/);
  });
});

describe("the external purchase URL", () => {
  it("puts the query BEFORE a fragment, so a section deep link survives", () => {
    // SettingsShell reads window.location.hash and matches it against section
    // ids. Appending the query after the hash made the fragment
    // "billing?src=ios_link", which matches nothing — the link silently landed
    // on the default section.
    expect(externalPurchaseUrl("/settings/flows#billing")).toBe(
      "https://swiftcard.me/settings/flows?src=ios_link#billing",
    );
  });

  it("still behaves for plain paths and paths that already have a query", () => {
    expect(externalPurchaseUrl("/upgrade")).toBe("https://swiftcard.me/upgrade?src=ios_link");
    expect(externalPurchaseUrl("/upgrade?plan=office")).toBe(
      "https://swiftcard.me/upgrade?plan=office&src=ios_link",
    );
  });
});
