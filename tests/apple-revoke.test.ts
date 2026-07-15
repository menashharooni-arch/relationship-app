import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { revokeAppleTokensOnDelete } from "@/lib/apple-revoke";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Item 10 — Apple token-revocation scaffolding. It must be a complete no-op for
// every normal (non-Apple) account and must never affect deletion.

describe("Item 10 — revocation is a no-op for non-Apple accounts", () => {
  it("returns not_apple for a null user", async () => {
    expect(await revokeAppleTokensOnDelete(null)).toBe("not_apple");
  });

  it("returns not_apple for a user with no identities", async () => {
    expect(await revokeAppleTokensOnDelete({})).toBe("not_apple");
    expect(await revokeAppleTokensOnDelete({ identities: [] })).toBe("not_apple");
  });

  it("returns not_apple for a user with only a google identity (today's real users)", async () => {
    const user = { identities: [{ provider: "google", identity_data: { email: "a@b.com" } }] };
    expect(await revokeAppleTokensOnDelete(user)).toBe("not_apple");
  });

  it("an Apple identity without env config skips gracefully (not_configured), never throws", async () => {
    const user = { identities: [{ provider: "apple", identity_data: { refresh_token: "x" } }] };
    // Env vars intentionally absent in the test environment.
    expect(await revokeAppleTokensOnDelete(user)).toBe("not_configured");
  });
});

describe("Item 10 — delete route wiring is safe (never blocks deletion)", () => {
  const route = read("src/app/api/account/delete/route.ts");
  it("calls the revoke helper inside a try/catch before signOut", () => {
    expect(route).toContain("revokeAppleTokensOnDelete(user)");
    expect(route).toMatch(/try \{\s*await revokeAppleTokensOnDelete\(user\);\s*\} catch/);
    const revokeIdx = route.indexOf("revokeAppleTokensOnDelete(user)");
    const signOutIdx = route.indexOf("supabase.auth.signOut()");
    expect(revokeIdx).toBeGreaterThan(-1);
    expect(signOutIdx).toBeGreaterThan(revokeIdx); // revoke happens before sign-out
  });
});
