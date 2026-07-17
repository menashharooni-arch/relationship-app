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
    expect(src).toMatch(/startNativeOAuth\(supabase, "apple", redirectTo\)/);
    expect(src).toMatch(/setErrorMsg/);
  });
  it("the button is rendered only when native", () => {
    expect(src).toMatch(/\{native && \(/);
    expect(src).toContain("Continue with Apple");
  });
});
