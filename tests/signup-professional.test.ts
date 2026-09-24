import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Professional signup (2026-09-24) ────────────────────────────────────────
//
// Confirm-password, one shared password rule, and errors in the user's words.
// Each pin is a state the form was in before: minLength=6 and nothing else,
// Supabase's raw "User already registered" on screen, red-400 on cream, a reset
// form with unlabelled boxes. These fail the day any of it quietly comes back.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const login = code("src/components/LoginForm.tsx");
const reset = code("src/components/ResetPasswordForm.tsx");
const field = code("src/components/PasswordField.tsx");

describe("one password rule, everywhere a password is set", () => {
  it("both forms import MIN_LENGTH from lib/password-policy and nothing hardcodes 6", () => {
    for (const [name, src] of [["LoginForm", login], ["ResetPasswordForm", reset]] as const) {
      expect(src, name).toMatch(/from "@\/lib\/password-policy"/);
      expect(src, name).toMatch(/\bMIN_LENGTH\b/);
      expect(src, name).toMatch(/assessPassword\(/);
      expect(src, name).not.toMatch(/minLength=\{6\}/);
      expect(src, name).not.toMatch(/6 characters/);
    }
  });

  it("sign-in has NO minLength — an account made under the old rule must still get in", () => {
    expect(login).toMatch(/minLength=\{mode === "signup" \? MIN_LENGTH : undefined\}/);
  });

  it("Settings → Security still hands off to the reset page rather than owning a third password form", () => {
    const settings = code("src/app/settings/flows/page.tsx");
    expect(settings).toContain('href="/auth/reset-password"');
    expect(settings).not.toMatch(/type="password"/);
  });
});

describe("create account asks for the password twice", () => {
  it("renders the confirm field only inside the signup branch", () => {
    const start = login.indexOf('{mode === "signup" && (\n          <PasswordField');
    expect(start, "confirm field lives in a signup-only block").toBeGreaterThan(-1);
    const block = login.slice(start, login.indexOf(")}", start));
    expect(block).toContain('id="auth-confirm-password"');
    expect(block).toContain('name="confirm_password"');
    expect(block).toContain('autoComplete="new-password"');
    // The only other mentions are the hydration read and the focus() call —
    // never a second rendered input.
    const renders = login.split('id="auth-confirm-password"').length - 1;
    expect(renders).toBe(1);
  });

  it("checks typo → policy → match before any request leaves, in that order", () => {
    const branch = login.slice(login.indexOf("const typo = suggestDomain(emailNow)"));
    const typo = 0;
    const policy = branch.indexOf("assessPassword(passwordNow, emailNow)");
    const match = branch.indexOf("CONFIRM_MISMATCH");
    const request = branch.indexOf("supabase.auth.signUp(");
    expect(typo).toBeGreaterThan(-1);
    expect(policy).toBeGreaterThan(typo);
    expect(match).toBeGreaterThan(policy);
    expect(request).toBeGreaterThan(match);
  });

  it("the reset form reads both boxes from the DOM at submit, like sign-in does", () => {
    expect(reset).toMatch(/const fd = new FormData\(e\.currentTarget as HTMLFormElement\)/);
    expect(reset).toMatch(/fd\.get\("password"\)/);
    expect(reset).toMatch(/fd\.get\("confirm_password"\)/);
    expect(reset).toMatch(/updateUser\(\{ password: passwordNow \}\)/);
  });
});

describe("a credential still never reaches a URL", () => {
  it("every form holding a password posts", () => {
    for (const [name, src] of [["LoginForm", login], ["ResetPasswordForm", reset]] as const) {
      const forms = src.match(/<form\b[^>]*>/g) ?? [];
      expect(forms.length, name).toBeGreaterThan(0);
      for (const tag of forms) expect(tag, name).toMatch(/method="post"/);
    }
  });

  it("PasswordField owns no form and reads no global", () => {
    expect(field).not.toMatch(/<form/);
    expect(field).not.toMatch(/\bwindow\./);
    expect(field).not.toMatch(/\bdocument\./);
  });
});

describe("errors are in the user's words, attached to the field", () => {
  it("the signup branch never renders Supabase's message verbatim", () => {
    const branch = login.slice(login.indexOf("const typo = suggestDomain(emailNow)"), login.indexOf("async function handleForgot"));
    expect(branch).toMatch(/friendlySignupError\(/);
    expect(branch).not.toMatch(/setErrorMsg\(error\.message\)/);
  });

  it("the six new strings exist", () => {
    for (const s of [
      "An account with this email already exists.",
      "Sign in instead",
      "We couldn't reach SwiftCard. Check your connection and try again.",
      "Creating your account…",
      "Did you mean",
      "Keep what I typed",
    ]) expect(login, s).toContain(s);
    expect(reset).toContain("Choose a password you haven't used on SwiftCard before.");
    expect(reset).toContain("We couldn't save that password. Please try again.");
  });

  it("no more red-400 on the cream card; every error is an alert", () => {
    for (const [name, src] of [["LoginForm", login], ["ResetPasswordForm", reset], ["PasswordField", field]] as const) {
      expect(src, name).not.toMatch(/text-red-400/);
      const errorPs = src.match(/<p[^>]*text-red-7\d\d[^>]*>/g) ?? [];
      expect(errorPs.length, `${name} has error lines`).toBeGreaterThan(0);
      for (const p of errorPs) expect(p, name).toMatch(/role="alert"/);
    }
  });

  it("PasswordField is labelled, describable, and warns about caps lock", () => {
    expect(field).toMatch(/<label htmlFor=\{id\}/);
    expect(field).toMatch(/aria-invalid=/);
    expect(field).toMatch(/aria-describedby=/);
    expect(field).toMatch(/getModifierState/);
    expect(field).toContain("Caps Lock is on.");
    expect(field).toMatch(/aria-label=\{show \? "Hide password" : "Show password"\}/);
  });

  it("the reset form's boxes are labelled with real names now", () => {
    expect(reset).toContain('id="reset-password"');
    expect(reset).toContain('id="reset-confirm-password"');
    expect(reset).toContain('name="confirm_password"');
    expect(reset).not.toMatch(/<input\s+type="password"/);
  });
});

describe("the support assistant knows the rule", () => {
  it("both knowledge entries say 8, and neither still says 6", () => {
    for (const p of ["src/lib/knowledge/docs/getting-started.ts", "src/lib/knowledge/docs/account.ts"]) {
      const doc = read(p);
      expect(doc, p).toMatch(/8 characters/);
      expect(doc, p).not.toMatch(/6 characters/);
    }
    expect(read("src/lib/knowledge/docs/getting-started.ts")).toContain("Did you mean");
    expect(read("src/lib/knowledge/docs/getting-started.ts")).toContain("An account with this email already exists.");
  });
});
