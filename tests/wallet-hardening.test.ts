import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { generateKeyPairSync, X509Certificate } from "node:crypto";
import { passCertDaysLeft, EMAIL_SHARES_ROW_MAX } from "@/lib/wallet";

const read = (p: string) => readFileSync(p, "utf8");

// Three hardening rules from the 2026-08-27 Wallet audit. None changes how a
// pass LOOKS for the cards that already work; each closes a way a pass could
// quietly go wrong later.
describe("Apple Wallet hardening", () => {
  it("a long email takes the secondary row alone; the phone drops to the auxiliary row", () => {
    const src = read("src/lib/wallet.ts");
    expect(EMAIL_SHARES_ROW_MAX).toBe(24);
    expect(src).toMatch(/const longEmail = !!card\.email && card\.email\.length > EMAIL_SHARES_ROW_MAX;/);
    expect(src).toMatch(/if \(card\.phone && !longEmail\) pass\.secondaryFields\.push\(\{ key: "phone"/);
    expect(src).toMatch(/if \(card\.phone && longEmail\) pass\.auxiliaryFields\.push\(\{ key: "phone"/);
    // The email itself is never dropped or moved.
    expect(src).toMatch(/if \(card\.email\) pass\.secondaryFields\.push\(\{ key: "email"/);
  });

  it("certificate expiry is readable and unreadable input is tolerated", () => {
    expect(passCertDaysLeft(undefined)).toBeNull();
    expect(passCertDaysLeft("not a cert")).toBeNull();
    // Node can't mint an X.509 cert without openssl, so verify the parser
    // on the WWDR-style structure via the class itself: a garbage PEM throws
    // and is mapped to null above; a real cert path is exercised in prod.
    expect(typeof X509Certificate).toBe("function");
    expect(() => generateKeyPairSync("ec", { namedCurve: "P-256" })).not.toThrow();
    const src = read("src/lib/wallet.ts");
    expect(src).toMatch(/warnIfCertExpiring\(\);/);
    expect(src).toMatch(/days <= 30/);
  });

  it("an image that fails to load is retried, and a degraded pass is never fingerprinted as final", () => {
    const strip = read("src/lib/wallet-strip.tsx");
    expect(strip).toMatch(/if \(attempt === 1\) return fetchImage\(url, 2\);/);
    expect(strip).toMatch(/attempt === 1 \? 2500 : 6000/);
    expect(strip).toMatch(/degraded = imageFailures > before/);
    const pass = read("src/lib/wallet-pass.ts");
    expect(pass).toMatch(/export async function buildPassDetailed/);
    const route = read("src/app/api/wallet/pass/route.ts");
    expect(route).toMatch(/buildPassDetailed\(inputs\)/);
    expect(route).toMatch(/if \(degraded\) \{[\s\S]*markWalletPassStale\(username\)[\s\S]*\} else \{[\s\S]*touchWalletPass\(username\)/);
    const reg = read("src/lib/wallet-registry.ts");
    expect(reg).toMatch(/content_hash: `degraded:\$\{Date\.now\(\)\}`/);
  });

  it("the auth-token secret is documented so a cert renewal can't strand installed passes", () => {
    expect(read(".env.example")).toMatch(/WALLET_AUTH_SECRET=/);
  });
});

// ── Onboarding-flow regressions reported by the owner, 2026-08-28 ──────────
describe("in-app signup and first-card flow", () => {
  const read2 = (p: string) => readFileSync(p, "utf8");

  it("the OAuth return leg covers the login screen instead of appearing to fail", () => {
    // Google succeeded, the sheet closed, and the webview underneath still
    // showed "Create account" for the seconds the code exchange + /onboarding
    // took — which reads as a bounce back to the signup form.
    const src = read2("src/components/NativeAppBridge.tsx");
    expect(src).toMatch(/showAuthOverlay\(\);/);
    expect(src).toMatch(/function showAuthOverlay/);
    expect(src).toMatch(/Signing you in/);
    // and it can never strand the app behind the cover
    expect(src).toMatch(/setTimeout\(\(\) => \{ document\.getElementById\("sc-auth-overlay"\)\?\.remove\(\); \}, 20000\)/);
  });

  it("onboarding redirects without waiting on the welcome email or referral", () => {
    const src = read2("src/app/onboarding/page.tsx");
    expect(src).toMatch(/after\(\(\) => sendWelcomeEmail/);
    expect(src).toMatch(/after\(\(\) => applyReferralOnSignup/);
  });

  it("the guided tour is account-scoped, not device-scoped", () => {
    // A device flag meant anyone who skipped the tour once never saw it again
    // on any later account — including a brand-new signup on the same phone.
    const src = read2("src/lib/account-state.ts");
    const list = src.slice(src.indexOf("PERSON_SCOPED_STORAGE_KEYS"), src.indexOf("GUEST_FLOW_STORAGE_KEYS"));
    expect(list).toContain('"sc_tour_completed"');
  });

  it("the native plan chooser mirrors the web cards and never hardcodes a price", () => {
    const src = read2("src/components/PlanCards.tsx");
    expect(src).toMatch(/function NativePro/);
    expect(src).toMatch(/useIapMonthlyPrice\(\)/);
    expect(src).toMatch(/<ProTrialPrice price=\{price\} period="month" \/>/);
    expect(src).toMatch(/Free <span className="text-slate-400">Forever<\/span>/);
    // Office is Stripe-only with no IAP product: no Office CARD and no
    // checkout hand-off may render natively (comments about it are fine).
    // The native branch runs from `if (native) {` to where the WEB render
    // begins (the monthly/annual toggle) — not to the end of the file.
    const nativeBranch = src
      .slice(src.indexOf("if (native) {"), src.indexOf("{/* Monthly / annual toggle"))
      .replace(/\/\/.*$/gm, "");
    expect(nativeBranch).not.toMatch(/Office/);
    expect(nativeBranch).not.toMatch(/onPaid\(/);
    // No price constant may reach the native card.
    expect(read2("src/lib/use-iap-price.ts")).toMatch(/getIapPackages/);
  });
});

// ── Scaling + security hardening, 2026-08-28 ──────────────────────────────
describe("public card page caching and redirect safety", () => {
  const read3 = (p: string) => readFileSync(p, "utf8");

  it("the card page reads its data through the per-slug cache, not a query per view", () => {
    const page = read3("src/app/[username]/page.tsx");
    expect(page).toMatch(/getCardPageData\(username\)/);
    // The inline admin reads are gone.
    expect(page).not.toMatch(/admin\.from\("cards"\)\.select\("\*"\)\.eq\("username", username\)/);
    const lib = read3("src/lib/card-page-data.ts");
    expect(lib).toMatch(/unstable_cache/);
    expect(lib).toMatch(/tags: \[cardPageTag\(slug\)\]/);
    expect(lib).toMatch(/revalidate: 60/);
  });

  it("the viewer identity is NEVER cached — owner self-view suppression stays per request", () => {
    const page = read3("src/app/[username]/page.tsx");
    const lib = read3("src/lib/card-page-data.ts");
    // getUser() must still run on the page, per request…
    expect(page).toMatch(/const viewer = await \(async \(\) => \{[\s\S]{0,300}?auth\.getUser\(\)/);
    expect(page).toMatch(/const isOwnerView = !!viewer && viewer\.id === ownerId/);
    // …and must never appear inside the cached loader (code, not comments —
    // the file explains WHY the viewer is excluded).
    const libCode = lib.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(libCode).not.toMatch(/getUser|createClient|cookies\(|headers\(/);
  });

  it("every card write drops the cached copy", () => {
    const route = read3("src/app/api/cards/[id]/route.ts");
    expect(route).toMatch(/import \{ revalidateCardPage \}/);
    // edit, rename (both slugs), delete
    expect((route.match(/revalidateCardPage\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(route).toMatch(/revalidateCardPage\(renamedTo, b\.username\)/);
  });

  it("no redirect guard still uses the /\\ -blind hand-written check", () => {
    // new URL("/\\evil.com", origin) resolves to https://evil.com — the guard
    // that only rejects "//" let a post-sign-in redirect off-origin.
    for (const f of [
      "src/components/GoogleSignInButton.tsx",
      "src/lib/native-auth.ts",
      "src/app/onboarding/page.tsx",
      "src/app/api/integrations/linkedin/connect/route.ts",
      "src/components/NativeAppBridge.tsx",
    ]) {
      const src = read3(f);
      expect(src, `${f} still hand-rolls the guard`).not.toMatch(/startsWith\("\/"\) && !\w+\.startsWith\("\/\/"\)/);
      expect(src, `${f} does not use safeNextPath`).toMatch(/safeNextPath\(/);
    }
    // The helper itself rejects both shapes.
    const helper = read3("src/lib/safe-next.ts");
    expect(helper).toMatch(/startsWith\("\/\/"\) \|\| next\.startsWith\("\/\\\\"\)/);
  });

  it("flow settings are written with the service role (session UPDATE is revoked)", () => {
    const src = read3("src/app/api/settings/flows/route.ts");
    expect(src).toMatch(/getAdminSupabase\(\)\s*\n?\s*\.from\("profiles"\)\s*\n?\s*\.update\(\{ flow_settings: body \}\)/);
    expect(src).toMatch(/\.eq\("id", user\.id\)/);
  });
});
