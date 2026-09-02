import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── LinkedIn headshot import must return INTO the app ────────────────────────
//
// The bug, reported from a phone: tapping "Connect LinkedIn" to import a
// headshot "takes me to our website page".
//
// Why it happened. The button was a plain <a href> to /api/integrations/
// linkedin/connect, which 302s to linkedin.com. linkedin.com is NOT in
// capacitor.config.ts's allowNavigation, so the shell refuses to load it in its
// own webview and hands the URL to the SYSTEM BROWSER. The user then authorised
// in Safari, LinkedIn redirected to https://swiftcard.me/... in Safari, and the
// journey ended on the marketing site — in a different app from the one they
// started in, with no photo imported and the editor untouched behind it.
//
// The fix has three halves and they only work together, which is why they are
// pinned in one place:
//   1. the button opens the flow in @capacitor/browser with ?native=1
//   2. the callback, seeing that flag, finishes at a swiftcard:// URL
//   3. NativeAppBridge catches that URL and puts the webview back on `next`
// Break any one and the user lands on the website again — silently, because
// every individual piece still "works".

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("LinkedIn connect leaves the webview correctly on iOS", () => {
  const suggest = read("src/components/ProfilePhotoSuggest.tsx");

  it("opens the in-app browser instead of navigating the webview", () => {
    expect(suggest).toMatch(/@capacitor\/browser/);
    expect(suggest).toMatch(/Browser\.open/);
  });

  it("never leaves the connect as a bare link on native", () => {
    // A plain <a href> is exactly the shape that produced the bug: the shell
    // sees a cross-origin 302 and hands the whole flow to Safari.
    const anchors = suggest.match(/<a\b[^>]*connectUrl[^>]*>/gs) ?? [];
    expect(anchors.length, "expected the connect anchors to still exist").toBeGreaterThan(0);
    for (const a of anchors) {
      expect(a, `connect anchor must intercept its click:\n${a}`).toMatch(/onClick=/);
    }
  });

  it("flags the run as native so the callback knows how to finish", () => {
    expect(suggest).toMatch(/native=1/);
  });
});

describe("the LinkedIn callback returns to the app, not the website", () => {
  const callback = read("src/app/api/integrations/linkedin/callback/route.ts");
  const connect = read("src/app/api/integrations/linkedin/connect/route.ts");

  it("connect records the native flag for the callback to read back", () => {
    // LinkedIn's registered redirect_uri is fixed, so nothing about this run
    // can ride in the URL — it has to be a cookie, same as the return path.
    expect(connect).toMatch(/li_native/);
    expect(connect).toMatch(/native.*===\s*"1"|"native"\)\s*===\s*"1"/s);
  });

  it("finishes at a swiftcard:// URL when the run started in the shell", () => {
    expect(callback).toMatch(/swiftcard:\/\/linkedin-callback/);
    expect(callback).toMatch(/li_native/);
  });

  it("still finishes at an https URL on the web", () => {
    // The web path must be untouched — this is the same route for both.
    expect(callback).toMatch(/NextResponse\.redirect\(url\.toString\(\)\)/);
  });

  it("clears both cookies on every exit", () => {
    // DONE() is the single exit. A stale li_native would send a LATER web
    // connect into a swiftcard:// redirect that a browser cannot follow.
    const done = callback.slice(callback.indexOf("const DONE"), callback.indexOf("if (!isLinkedInEnabled"));
    expect(done).toMatch(/li_return_to["']\s*,\s*["']{2}/);
    expect(done).toMatch(/li_native["']\s*,\s*["']{2}/);
  });
});

describe("the app handles the LinkedIn return leg", () => {
  const bridge = read("src/components/NativeAppBridge.tsx");

  it("routes swiftcard://linkedin-callback before the auth handler", () => {
    // Both are swiftcard: URLs. completeNativeOAuth would reject this one (no
    // code to exchange), so ordering is load-bearing, not cosmetic.
    const li = bridge.indexOf("swiftcard://linkedin-callback");
    const auth = bridge.indexOf('url.startsWith("swiftcard:")');
    expect(li, "linkedin-callback branch missing").toBeGreaterThan(-1);
    expect(li, "linkedin branch must come before the generic swiftcard: branch").toBeLessThan(auth);
  });

  it("only ever steers the webview to a same-origin path", () => {
    // appUrlOpen is attacker-reachable: any installed app can open a
    // swiftcard:// URL, so `next` is untrusted input aimed at window.location.
    const branch = bridge.slice(
      bridge.indexOf("swiftcard://linkedin-callback"),
      bridge.indexOf('url.startsWith("swiftcard:")'),
    );
    // One shared guard now, rejecting "//" and "/\\" alike.
    expect(branch).toMatch(/safeNextPath\(nextRaw\)/);
  });
});

describe("connecting from the headshot section auto-applies the photo", () => {
  const suggest = read("src/components/ProfilePhotoSuggest.tsx");

  it("the OAuth return leg (?integration=linkedin&status=connected) imports without a second click", () => {
    // Owner bug report 2026-09-02: connect finished, nothing happened — the
    // user had to press "Suggest my profile picture" again to see the photo.
    const effect = suggest.slice(suggest.indexOf("useEffect"), suggest.indexOf("async function suggest"));
    expect(effect).toMatch(/integration.*linkedin/);
    expect(effect).toMatch(/status === "connected"/);
    expect(effect).toMatch(/\/api\/integrations\/linkedin.*method: "POST"|method: "POST"/);
    expect(effect).toMatch(/onConfirm\(data\.url\)/);
  });

  it("strips the params before importing so a refresh can't re-run the leg", () => {
    const effect = suggest.slice(suggest.indexOf("useEffect"), suggest.indexOf("async function suggest"));
    expect(effect).toMatch(/replaceState/);
    // The strip happens before the import call.
    expect(effect.indexOf("replaceState")).toBeLessThan(effect.indexOf('status === "connected"'));
  });

  it("falls back to the visible suggestion flow when the import can't complete", () => {
    // Revoked token / photo-less profile must surface the reconnect UI, not silence.
    const effect = suggest.slice(suggest.indexOf("useEffect"), suggest.indexOf("async function suggest"));
    expect(effect).toMatch(/void suggest\(\)/);
  });

  it("guests are excluded — their photo returns via ?li_photo= to the builder", () => {
    const effect = suggest.slice(suggest.indexOf("useEffect"), suggest.indexOf("async function suggest"));
    expect(effect).toMatch(/if \(guest\) return/);
    expect(read("src/app/cards/new/NewCardWizard.tsx")).toMatch(/li_photo/);
  });
});
