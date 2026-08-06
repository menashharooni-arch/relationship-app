import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SIGNUP_SOURCES, isSignupSource } from "@/lib/referral";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("/r/[code] does not assert a referral it can't back up", () => {
  const R = "src/app/r/[code]/route.ts";

  it("resolves the code against a real profile first", () => {
    const c = code(R);
    expect(c).toMatch(/\.eq\("referral_code", clean\)/);
    expect(c).toMatch(/resolved = !!data/);
  });

  it("only sets the cookies when a referrer exists", () => {
    const c = code(R);
    expect(c).toMatch(/if \(resolved\) \{[\s\S]{0,300}?SRC_COOKIE, "referral"/);
    expect(c, "still sets the source for any non-empty string").not.toMatch(/if \(clean\) \{[\s\S]{0,200}?SRC_COOKIE/);
  });

  it("only promises the free month when it can be honoured", () => {
    // ?ref=1 drives the "your friend gave you a free month" headline.
    expect(code(R)).toMatch(/\$\{resolved \? "&ref=1" : ""\}/);
  });

  it("a lookup failure degrades to direct rather than breaking the link", () => {
    const c = code(R);
    expect(c).toMatch(/try \{[\s\S]*?\} catch \{/);
  });
});

describe("the nudge's ?src= is finally read", () => {
  it("every source the app actually fires is a valid source name", () => {
    // triggerSignupNudge("share_card") existed with no matching entry, so
    // isSignupSource rejected it and those signups read as "direct".
    for (const s of ["referral", "save_contact", "share_info", "vcard", "link_button", "share_card", "badge", "follow_up", "preview", "direct"]) {
      expect(isSignupSource(s), `${s} is not a recognised signup source`).toBe(true);
    }
    expect(SIGNUP_SOURCES).toContain("share_card");
  });

  it("/cards/new writes the source cookie from the param", () => {
    const c = code("src/app/cards/new/page.tsx");
    expect(c).toMatch(/isSignupSource\(sp\.src\)/);
    expect(c).toMatch(/jar\.set\(SRC_COOKIE, sp\.src/);
  });

  it("refuses ?src=referral — that one carries a free month", () => {
    // Only /r/[code], with a resolved referrer, may claim the referral source.
    expect(code("src/app/cards/new/page.tsx")).toMatch(/sp\.src !== "referral"/);
  });

  it("first touch wins — an existing attribution isn't clobbered", () => {
    expect(code("src/app/cards/new/page.tsx")).toMatch(/if \(!jar\.get\(SRC_COOKIE\)\)/);
  });

  it("the nudge CTA still sends it", () => {
    expect(code("src/components/SignupNudgeHost.tsx")).toMatch(/\/cards\/new\?src=\$\{encodeURIComponent\(source\)\}/);
  });
});

describe("the guided tour reaches a brand-new account", () => {
  it("auto-start is mounted in BOTH dashboard branches", () => {
    // Onboarding sends a new account to /dashboard?welcome=1, and a new
    // account has no cards — so it always hit the empty-state branch, which
    // never mounted the component.
    const c = code("src/app/dashboard/page.tsx");
    const mounts = c.match(/<Suspense><TourAutoStart \/><\/Suspense>/g) ?? [];
    expect(mounts.length, "only one branch mounts the tour").toBe(2);
  });

  it("the card-less branch mounts it before its early return", () => {
    const c = code("src/app/dashboard/page.tsx");
    const emptyBranchAt = c.indexOf("if (!hasCards)");
    const firstMountAt = c.indexOf("<Suspense><TourAutoStart /></Suspense>");
    expect(emptyBranchAt).toBeGreaterThan(0);
    expect(firstMountAt).toBeGreaterThan(emptyBranchAt);
  });
});
