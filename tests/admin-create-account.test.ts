import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ROUTE = "src/app/api/admin/create-card/route.ts";

describe("admin create-card checks the whole slug namespace", () => {
  it("uses the shared slugTaken rather than a profiles-only lookup", () => {
    // Card slugs and profile handles share one public namespace. Checking one
    // table meant an admin could pick a username matching an existing CARD,
    // sail past this, collide on the card insert, and be shown success — while
    // the new account had no card and its URL served a stranger's.
    const c = code(ROUTE);
    expect(c).toMatch(/await slugTaken\(admin, username\)/);
    expect(c, "still checks profiles alone").not.toMatch(
      /from\("profiles"\)\.select\("id"\)\.eq\("username", username\)/,
    );
  });

  it("slugTaken really does look at both tables", () => {
    const c = code("src/lib/username.ts");
    expect(c).toMatch(/export async function slugTaken/);
    expect(c).toMatch(/from\("cards"\)/);
    expect(c).toMatch(/from\("profiles"\)/);
  });
});

describe("an admin-created account can actually be logged into", () => {
  it("sends the recovery link instead of discarding it", () => {
    // generateLink GENERATES a link for a custom mail provider; it sends
    // nothing. Its result was thrown away, so every /admin-provisioned account
    // (email confirmed, no password) was unreachable by its owner.
    const c = code(ROUTE);
    expect(c).toMatch(/generateLink\(/);
    expect(c).toMatch(/properties\?\.action_link/);
    expect(c).toMatch(/sendRawEmail\(/);
  });

  it("reports whether the email actually went out", () => {
    const c = code(ROUTE);
    expect(c).toMatch(/loginEmailed/);
    // ...and hands back the link when it didn't, so the admin isn't stuck.
    expect(c).toMatch(/setupLink: loginEmailed \? null : setupLink/);
  });

  it("points the link at the password-setting page, not the dashboard", () => {
    expect(code(ROUTE)).toMatch(/redirectTo: `\$\{APP_URL\}\/reset-password`/);
  });

  it("cannot throw and lose the created account", () => {
    const c = code(ROUTE);
    expect(c).toMatch(/try \{[\s\S]*?generateLink[\s\S]*?\} catch/);
  });
});

describe("a failed card insert doesn't mark the account migrated", () => {
  it("checks the insert error and returns before stamping the flag", () => {
    // The result was ignored, so a unique-violation left an account with no
    // card AND flagged _migrated — meaning this never retried.
    const c = code("src/lib/ensure-cards.ts");
    expect(c).toMatch(/const \{ error: insertErr \} = await admin\.from\("cards"\)\.insert\(row\)/);
    expect(c).toMatch(/if \(insertErr\)/);
    const errAt = c.indexOf("if (insertErr)");
    const flagAt = c.indexOf("_migrated: true");
    expect(errAt).toBeGreaterThan(0);
    expect(errAt, "the flag is stamped regardless of the insert failing").toBeLessThan(flagAt);
  });
});
