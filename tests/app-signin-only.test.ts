import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { isNativeRequest } from "@/lib/native-request";

// ── The app signs you in; it never creates an account ────────────────────────
//
// Owner decision: accounts are made on the website. The app keeps BOTH toggle
// options so the answer is discoverable where people look for it — but the
// "Create account" side opens no form. It shows one line pointing at the
// website, with swiftcard.me as the only interactive thing on it.
//
// Rendered rather than grepped: the point is what each tab actually PAINTS. A
// source scan cannot tell "Create account" inside a live button from the same
// words in a comment, and this area is now heavily commented.
//
// signInOnly comes from the SERVER (isNativeRequest), not useIsNativeApp(),
// which is false on the first render — a client gate would paint a signup form
// for one frame. No effects run here, so useIsNativeApp() stays false, which is
// exactly the first-paint state being asserted.

vi.mock("@supabase/ssr", () => ({ createBrowserClient: () => ({ auth: {} }) }));
vi.mock("@/components/GoogleSignInButton", () => ({
  default: () => createElement("div", { "data-testid": "gis" }),
}));

const MESSAGE = "Ready to grow your network? Accounts are created on";
const LINK_TEXT = "SwiftCard.me";

async function render(props: Record<string, unknown>) {
  const { default: LoginForm } = await import("@/components/LoginForm");
  return renderToStaticMarkup(createElement(LoginForm, props));
}

/** The app's "Create account" tab. */
const appSignup = () => render({ signInOnly: true, initialMode: "signup" });
/** The app's "Sign in" tab. */
const appSignin = () => render({ signInOnly: true, initialMode: "signin" });

describe("isNativeRequest — which requests get the app treatment", () => {
  it("detects the shell from the user-agent token", () => {
    expect(isNativeRequest("Mozilla/5.0 (iPhone) SwiftCardApp", null)).toBe(true);
  });

  it("detects an already-installed build from the sc_shell cookie", () => {
    // Builds shipped before appendUserAgent carry no UA token; the boot script
    // plants this cookie the first time it detects the shell.
    expect(isNativeRequest("Mozilla/5.0 (iPhone)", "1")).toBe(true);
  });

  it("leaves the website alone", () => {
    expect(isNativeRequest("Mozilla/5.0 (Macintosh) Safari/605", null)).toBe(false);
    expect(isNativeRequest(null, null)).toBe(false);
    expect(isNativeRequest("Mozilla/5.0", "0")).toBe(false);
  });
});

describe("the app keeps both toggle options", () => {
  it("offers Sign in AND Create account", async () => {
    // The option is deliberately still there — removing it makes the answer
    // undiscoverable rather than clear.
    const html = await appSignin();
    expect(html).toMatch(/>Sign in</);
    expect(html).toMatch(/>Create account</);
  });

  it("the Sign in tab is a working login form", async () => {
    const html = await appSignin();
    expect(html).toMatch(/type="email"/);
    expect(html).toMatch(/type="password"/);
    expect(html).toMatch(/type="submit"/);
    // …and shows no message, which belongs to the other tab.
    expect(html).not.toContain(MESSAGE);
  });
});

describe("the app's Create account tab offers a message, not an account", () => {
  it("shows the exact copy", async () => {
    const html = await appSignup();
    expect(html).toContain(MESSAGE);
    expect(html).toContain(LINK_TEXT);
  });

  it("renders NO way to create an account", async () => {
    // The whole requirement. Everything that could make an account has to be
    // gone from this tab — including the OAuth buttons, which create one on
    // first sign-in.
    const html = await appSignup();
    expect(html, "email field still rendered").not.toMatch(/type="email"/);
    expect(html, "password field still rendered").not.toMatch(/type="password"/);
    expect(html, "submit button still rendered").not.toMatch(/type="submit"/);
    expect(html, "Google sign-in still rendered").not.toMatch(/gis|Continue with Google/);
    expect(html, "Apple sign-in still rendered").not.toMatch(/Continue with Apple/);
    expect(html, "forgot-password still rendered").not.toMatch(/Forgot password/);
    expect(html, "signup terms notice still rendered").not.toMatch(/By creating an account/);
  });

  it("offers a WORKING create-account button that leaves the app", async () => {
    // App Review 2.1(a): a no-account Apple sign-in bounces here, and the old
    // card was a dead end — a message whose only affordance was a small inline
    // link, filed by the reviewer as an unresponsive "Create account" button.
    // The card must now paint a real primary button.
    const html = await appSignup();
    expect(html).toContain("Create your account on SwiftCard.me");
    const i = html.indexOf("Create your account on SwiftCard.me");
    const openTag = html.lastIndexOf("<button", i);
    expect(openTag, "the create-account CTA must be a <button>").toBeGreaterThan(-1);
    expect(html.slice(openTag, i)).not.toContain("</button>");
  });

  it("never renders an in-webview anchor to the site", async () => {
    // An <a href="https://swiftcard.me"> would navigate INSIDE the webview
    // (the host is allow-listed) and expose the pricing nav in-app (3.1.1).
    // The button leaves through the native plugin instead.
    const html = await appSignup();
    expect(html).not.toMatch(/<a[^>]*href="https:\/\/swiftcard\.me/);
    const src = (await import("node:fs")).readFileSync("src/components/LoginForm.tsx", "utf8");
    expect(src).toMatch(/openInDefaultBrowser\("\/cards\/new\?src=ios_signup"\)/);
  });

  it("keeps the toggle so the user can get back to signing in", async () => {
    // A dead end would be worse than the form it replaced.
    const html = await appSignup();
    expect(html).toMatch(/>Sign in</);
  });
});

describe("the website still creates accounts", () => {
  it("shows the real signup form on ?mode=signup", async () => {
    const html = await render({ initialMode: "signup" });
    expect(html).toMatch(/type="email"/);
    expect(html).toMatch(/type="password"/);
    expect(html).toMatch(/Create account →/);
    expect(html).toMatch(/By creating an account/);
  });

  it("never shows the app-only message", async () => {
    for (const mode of ["signin", "signup"] as const) {
      const html = await render({ initialMode: mode });
      expect(html, `web ${mode} leaked the app message`).not.toContain(MESSAGE);
    }
  });

  it("still has both toggle options", async () => {
    const html = await render({});
    expect(html).toMatch(/>Sign in</);
    expect(html).toMatch(/>Create account</);
  });
});
