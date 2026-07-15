import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Item 7 — Office "Team management" gate on native.
// The server-side guard can't reliably detect the native app, so its redirect
// stays EXACTLY as today (redirect("/pricing")) and web is untouched. Native
// safety is achieved downstream: /pricing itself redirects to /dashboard on
// native, so a non-Office native user who hits /office/admin lands on the
// dashboard without ever seeing a selling page.

describe("Item 7 — office admin guard web path is unchanged", () => {
  const guard = read("src/lib/office-admin-guard.ts");
  it('still redirects non-Office users to "/pricing" on web (byte-for-byte)', () => {
    expect(guard).toContain('if (profile.plan !== "enterprise") redirect("/pricing");');
  });
  it("was not given any unreliable server-side native detection", () => {
    expect(guard).not.toMatch(/isNativeApp|detectNativeApp|native/i);
  });
});

describe("Item 7 — /pricing redirects to /dashboard on native", () => {
  const pricing = read("src/app/pricing/page.tsx");
  it("uses a client-side native redirect to the dashboard", () => {
    expect(pricing).toMatch(/detectNativeApp\(\)/);
    expect(pricing).toMatch(/router\.replace\("\/dashboard"\)/);
  });
});
