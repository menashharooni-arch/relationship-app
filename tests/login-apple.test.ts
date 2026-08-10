import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// LoginForm constructs a Supabase browser client at render; give it dummy env so
// the component can render in the test. (Not used — no network in these tests.)
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

// eslint-disable-next-line import/first
import LoginForm from "@/components/LoginForm";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Item 9 — native-only "Continue with Apple" button.

describe("Item 9 — Apple button never renders on web", () => {
  it("web login form (native false in SSR) offers Google sign-in but NOT Apple", () => {
    const out = renderToStaticMarkup(h(LoginForm, { initialMode: "signin" as const }));
    // On web the Google option is now the Google Identity Services button
    // (rendered client-side by GoogleSignInButton), so the SSR markup shows its
    // container/placeholder rather than the old "Continue with Google" text.
    // The web tree must still present a Google sign-in affordance and must NOT
    // render the native-only Apple button.
    expect(out).toMatch(/Google/);
    expect(out).not.toContain("Continue with Apple");
  });
});

describe("Item 9 — Apple handler mirrors Google and is native-gated", () => {
  const src = read("src/components/LoginForm.tsx");
  it("routes Apple sign-in through the system-browser native flow and handles errors", () => {
    // The native Apple handler now uses startNativeOAuth (system browser +
    // swiftcard:// return) — embedded-webview OAuth is unreliable on iOS.
    expect(src).toMatch(/startNativeOAuth\(supabase, "apple", redirectTo, mode\)/);
    expect(src).toMatch(/setErrorMsg/);
  });
  it("the button is rendered only when native — and only when Apple actually works", () => {
    // Was `{native && (`. Still native-gated, now also gated on the provider
    // being enabled: it rendered while Supabase's Apple provider was off, so
    // every tap failed with an error toast next to a working Google button.
    // See tests/admin-downgrade-cascade.test.ts for the availability gate.
    expect(src).toMatch(/\{native && APPLE_SIGNIN_ENABLED && \(/);
    expect(src).toContain("Continue with Apple");
  });

  // Guideline 4.8 is about the COMBINATION, not about Apple in isolation:
  // offering a third-party social login in-app obliges an equivalent private
  // option. So the kill switch has to take Google down WITH Apple on native —
  // hiding only Apple would leave Google standing alone and turn a switch that
  // exists to prevent a 2.1 into a guaranteed 4.8 on the next submission.
  // Native then falls back to email/password, which owes Apple nothing.
  it("the kill switch hides native Google too, or it manufactures a 4.8", () => {
    // the native branch opens with the same gate that guards Apple
    expect(src).toMatch(/\{native \?\s*\(?\s*APPLE_SIGNIN_ENABLED && \(/);
    // and the native Google button lives inside it
    const nativeBranch = src.slice(src.indexOf("{native ?"), src.indexOf("<GoogleSignInButton"));
    expect(nativeBranch).toContain("Continue with Google");
    expect(nativeBranch).toContain("APPLE_SIGNIN_ENABLED");
  });

  it("web is untouched by that gate — GoogleSignInButton always renders there", () => {
    // The obligation is in-app only; the website keeps its Google button
    // regardless of whether the native Apple provider is healthy. Slice just
    // the ternary's else-branch — reading to end of file would swallow the
    // Apple block that legitimately follows.
    const start = src.indexOf("<GoogleSignInButton");
    const webBranch = src.slice(start, src.indexOf(")}", start));
    expect(webBranch).toContain("GoogleSignInButton");
    expect(webBranch).not.toContain("APPLE_SIGNIN_ENABLED");
  });
});
