import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { isNativeRequest } from "@/lib/native-request";

// ── The app signs you in; it never creates an account ────────────────────────
//
// Owner decision: accounts are made on the website. The iOS shell's auth screen
// offers sign-in only, and where the signup affordance used to be there is one
// STATIC line — not a link, not a button, because anything tappable there
// either dead-ends or throws the user out to Safari.
//
// Rendered rather than grepped: the point is what the auth screen actually
// PAINTS for each variant. A source scan cannot tell "Create account" inside a
// live button from the same words in a comment, and this file is now full of
// comments explaining why the words are gone.
//
// signInOnly comes from the SERVER (isNativeRequest) rather than from
// useIsNativeApp(), which is false on the first render — a client-side gate
// would paint the signup tab for one frame and then remove it. In these tests
// no effects run, so useIsNativeApp() is false throughout, which is exactly the
// first-paint state being asserted.

vi.mock("@supabase/ssr", () => ({ createBrowserClient: () => ({ auth: {} }) }));
vi.mock("@/components/GoogleSignInButton", () => ({
  default: () => createElement("div", { "data-testid": "gis" }),
}));

const SIGNUP_WORDS = [/create account/i, /create an account/i, /sign ?up/i, /register/i];
const LINE = "Start building your network at swiftcard.me";

async function render(props: Record<string, unknown>) {
  const { default: LoginForm } = await import("@/components/LoginForm");
  return renderToStaticMarkup(createElement(LoginForm, props));
}

describe("isNativeRequest — which requests get the sign-in-only screen", () => {
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
    // A cookie value that is not exactly "1" must not count.
    expect(isNativeRequest("Mozilla/5.0", "0")).toBe(false);
  });
});

describe("the app's auth screen offers sign-in only", () => {
  it("paints no signup affordance anywhere", async () => {
    const html = await render({ signInOnly: true });
    for (const w of SIGNUP_WORDS) {
      expect(html, `signup wording still rendered: ${w}`).not.toMatch(w);
    }
  });

  it("shows the static line exactly once", async () => {
    const html = await render({ signInOnly: true });
    expect(html).toContain(LINE);
    expect(html.split(LINE).length - 1, "line rendered more than once").toBe(1);
  });

  it("renders that line as plain text — not a link, not a button", async () => {
    // The whole requirement. If this ever becomes tappable it either dead-ends
    // or hands the user to Safari, which is the behaviour being removed.
    const html = await render({ signInOnly: true });
    const i = html.indexOf(LINE);
    // Walk back to the tag that opens the element containing the line.
    const openTag = html.lastIndexOf("<", i);
    const tag = html.slice(openTag, i);
    expect(tag, `line is wrapped in an interactive element: ${tag}`).toMatch(/^<p\b/);
    expect(tag).not.toMatch(/href=/);
    expect(tag).not.toMatch(/onclick/i);
    expect(tag).not.toMatch(/role="button"/);
  });

  it("still renders a working sign-in form", async () => {
    // Removing signup must not remove the ability to log in.
    const html = await render({ signInOnly: true });
    expect(html).toMatch(/type="email"/);
    expect(html).toMatch(/type="password"/);
    expect(html).toMatch(/type="submit"/);
    expect(html).toMatch(/Sign in/);
  });

  it("cannot be put back into signup by a deep link", async () => {
    // /login?mode=signup is ignored in the app, but assert the component itself
    // refuses too — a stale push or referral URL must not reopen signup.
    const html = await render({ signInOnly: true, initialMode: "signup" });
    for (const w of SIGNUP_WORDS) {
      expect(html, `initialMode=signup leaked through: ${w}`).not.toMatch(w);
    }
    expect(html).toContain(LINE);
  });
});

describe("the website keeps account creation", () => {
  it("still shows the signup toggle", async () => {
    const html = await render({});
    expect(html).toMatch(/Create account/);
    expect(html).toMatch(/Sign in/);
  });

  it("does not show the app-only line", async () => {
    const html = await render({});
    expect(html).not.toContain(LINE);
  });

  it("still honours ?mode=signup", async () => {
    const html = await render({ initialMode: "signup" });
    expect(html).toMatch(/Create account/);
  });
});
