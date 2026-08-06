import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("reopen is reachable right after deleting", () => {
  const PAGE = "src/app/account-deleted/page.tsx";

  it("has a distinct no-session branch", () => {
    // The delete route signs you out and redirects here, so no session is the
    // MOST likely state — and it used to fall through to the permanent
    // "your account has been deleted" branch, contradicting the 30-day promise
    // the user had just accepted.
    const c = code(PAGE);
    expect(c).toMatch(/\) : !user \? \(/);
  });

  it("that branch offers a way back in", () => {
    const c = code(PAGE);
    expect(c).toMatch(/Sign in to reopen/);
    expect(c).toMatch(/\/login\?next=\/account-deleted/);
  });

  it("and states the window rather than declaring it over", () => {
    const c = code(PAGE);
    const idx = c.indexOf(") : !user ? (");
    const branch = c.slice(idx, idx + 900);
    expect(branch).toMatch(/scheduled for deletion/);
    expect(branch).toMatch(/\{GRACE_DAYS\} days/);
    expect(branch, "still tells a recoverable user they are permanently gone").not.toMatch(
      /has been deleted<\/h1>/,
    );
  });
});

describe("a reset link works on a device other than the one that asked", () => {
  const FORM = "src/components/ResetPasswordForm.tsx";

  it("handles the device-independent token_hash path", () => {
    // exchangeCodeForSession is PKCE: the verifier lives only in the
    // localStorage of the REQUESTING device, so "request on laptop, open on
    // phone" always failed and the page blamed the link.
    const c = code(FORM);
    expect(c).toMatch(/verifyOtp\(/);
    expect(c).toMatch(/token_hash/);
  });

  it("also handles the implicit-flow fragment", () => {
    const c = code(FORM);
    expect(c).toMatch(/window\.location\.hash/);
    expect(c).toMatch(/setSession\(/);
  });

  it("still handles the PKCE code for same-device links", () => {
    expect(code(FORM)).toMatch(/exchangeCodeForSession\(code\)/);
  });

  it("strips the credential from the URL on every path", () => {
    const c = code(FORM);
    expect(c).toMatch(/window\.history\.replaceState/);
  });

  it("offers a resend on the failure screen itself", () => {
    // Sending them back to /login is what made this a loop: the same request
    // produces the same device-bound link and the same dead end.
    const c = code(FORM);
    expect(c).toMatch(/resetPasswordForEmail\(/);
    expect(c).toMatch(/Send me a new link/);
  });

  it("does not reveal whether an account exists for the address", () => {
    const c = code(FORM);
    expect(c).toMatch(/setResendState\(error \? "sent" : "sent"\)/);
    expect(c).toMatch(/If there&apos;s an account for that address/);
  });

  it("no longer blames the link outright", () => {
    expect(code(FORM)).not.toMatch(/This password reset link is invalid or has expired/);
  });
});

describe("the Google button never hangs on Loading", () => {
  const BTN = "src/components/GoogleSignInButton.tsx";

  it("native reaches a terminal phase instead of returning early", () => {
    const c = code(BTN);
    expect(c).toMatch(/if \(detectNativeApp\(\)\) \{[\s\S]{0,120}?setPhase\("unavailable"\)/);
  });

  it("'unavailable' is a real phase, and renders nothing", () => {
    const c = code(BTN);
    expect(c).toMatch(/"unavailable"/);
    // No branch renders a pill for it — the loading pill is keyed to "loading".
    expect(c).toMatch(/phase === "loading" &&/);
    expect(c).not.toMatch(/phase === "unavailable" &&\s*\(/);
  });

  it("the office invite page renders this component directly — which is why it mattered", () => {
    expect(code("src/components/JoinSignIn.tsx")).toMatch(/GoogleSignInButton/);
  });
});
