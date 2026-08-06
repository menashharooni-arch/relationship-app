import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// An admin downgrading an Office owner to Free cancelled the subscription AND
// nulled stripe_subscription_id in the same synchronous request. The
// customer.subscription.deleted handler finds the profile ONLY by that column,
// so it arrived moments later and matched nothing — leaving every seat holder
// on plan='enterprise' with nobody paying, the offices row alive, the brand
// applied, and the ex-owner holding every office capability.

const ADMIN_ROUTES = [
  "src/app/api/admin/set-plan/route.ts",
  "src/app/api/admin/users/[id]/route.ts",
];

describe("admin downgrade leaves the webhook's handle intact", () => {
  it.each(ADMIN_ROUTES)("%s does not null stripe_subscription_id", (f) => {
    expect(
      code(f),
      `${f} clears the column the deleted-webhook needs to find this profile`,
    ).not.toMatch(/stripe_subscription_id: null/);
  });

  it.each(ADMIN_ROUTES)("%s still cancels the subscription", (f) => {
    // The cancel is the point — a downgrade that leaves Stripe billing is the
    // bug this route was written to prevent. Only the column write changed.
    expect(code(f)).toMatch(/subscriptions\.cancel\(/);
  });

  it.each(ADMIN_ROUTES)("%s aborts the plan change if the cancel fails", (f) => {
    // Otherwise the user reads as free while Stripe keeps charging them.
    expect(code(f)).toMatch(/status: 502/);
  });

  it("the webhook is the one that clears it, and only after the cascade", () => {
    const w = code("src/app/api/stripe/webhook/route.ts");
    // It finds the profile by the column...
    expect(w).toMatch(/\.eq\("stripe_subscription_id", sub\.id\)/);
    // ...and the clear is guarded on that same id, so a retry after the
    // customer resubscribed can't wipe the NEW subscription's link.
    expect(w).toMatch(
      /update\(\{ stripe_subscription_id: null \}\)[\s\S]{0,80}?\.eq\("stripe_subscription_id", sub\.id\)/,
    );
  });

  it("the clear is the LAST subscription write in the deleted handler", () => {
    const w = code("src/app/api/stripe/webhook/route.ts");
    const start = w.indexOf('event.type === "customer.subscription.deleted"');
    expect(start).toBeGreaterThan(0);
    const handler = w.slice(start);
    const clearAt = handler.indexOf("stripe_subscription_id: null");
    const planWriteAt = handler.indexOf('update({ plan: "free" })');
    expect(clearAt).toBeGreaterThan(planWriteAt);
  });
});

describe("Sign in with Apple is not offered until it works", () => {
  const FORM = "src/components/LoginForm.tsx";

  it("is gated on availability, not just on being in the native app", () => {
    const c = code(FORM);
    expect(c).toMatch(/APPLE_SIGNIN_ENABLED/);
    expect(c, "still renders on platform alone").toMatch(/\{native && APPLE_SIGNIN_ENABLED &&/);
  });

  it("defaults OFF — an unset or stray env value must not enable it", () => {
    expect(code(FORM)).toMatch(
      /const APPLE_SIGNIN_ENABLED = process\.env\.NEXT_PUBLIC_APPLE_SIGNIN_ENABLED === "1"/,
    );
  });

  it("Google is untouched — it works and must keep rendering", () => {
    const c = code(FORM);
    expect(c).toMatch(/GoogleSignInButton/);
    expect(c).not.toMatch(/APPLE_SIGNIN_ENABLED[\s\S]{0,40}GoogleSignInButton/);
  });
});
