import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canSeeBilling, type OfficeContext } from "@/lib/office-roles";

// ── An Office member is never billed, so never offered receipts ──────────────
//
// Owner request 2026-09-06: on the Office plan the admin pays, so a member must
// not be shown "Payment receipts — confirmation emails when you're billed".
// It is worse than clutter: the receipt path is keyed to the user who holds the
// Stripe subscription (api/stripe/webhook), so that switch was offering a
// member control over mail that could never reach them.
//
// The two exceptions are real money and must survive: a delegated billing_admin
// runs the organisation's billing, and a member who kept a PERSONAL
// subscription from before joining is still charged every month — hiding it
// from them is how someone pays for a subscription they cannot see.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const office = (role: OfficeContext["role"], isOwner = false): OfficeContext => ({
  officeId: "off_1", ownerId: "owner_1", role, isOwner,
});

describe("who is shown billing", () => {
  it("a solo account always is", () => {
    expect(canSeeBilling(null, null)).toBe(true);
    expect(canSeeBilling(undefined, null)).toBe(true);
  });

  it("the office owner is — they are the one paying", () => {
    expect(canSeeBilling(office("owner", true), null)).toBe(true);
  });

  it("an ordinary member is NOT", () => {
    for (const role of ["employee", "manager", "admin"] as const) {
      expect(canSeeBilling(office(role), null), role).toBe(false);
    }
  });

  it("a delegated billing_admin is", () => {
    expect(canSeeBilling(office("billing_admin"), null)).toBe(true);
  });

  it("a member with their own subscription is — they really are charged", () => {
    expect(canSeeBilling(office("employee"), "sub_123")).toBe(true);
    // …and an empty string is not a subscription.
    expect(canSeeBilling(office("employee"), "")).toBe(false);
  });
});

describe("both settings surfaces use the one rule", () => {
  it("the form takes showReceipts and gates the row on it", () => {
    const src = read("src/components/EmailPreferencesForm.tsx");
    expect(src).toMatch(/showReceipts = true/);
    expect(src).toMatch(/\{showReceipts && \(/);
    // Marketing is NOT gated — every account can be marketed to.
    const marketing = src.indexOf('label="Marketing emails"');
    const gate = src.indexOf("{showReceipts && (");
    expect(marketing).toBeLessThan(gate);
  });

  it("hiding the row never rewrites the stored preference", () => {
    // The value still rides along in the PATCH, straight from initialReceipts,
    // so a member's stored setting is preserved rather than reset by a save
    // they made for an unrelated toggle.
    const src = read("src/components/EmailPreferencesForm.tsx");
    expect(src).toMatch(/receipt_emails: receipts/);
    expect(src).toMatch(/useState\(initialReceipts\)/);
  });

  it("/settings and /profile both derive it from canSeeBilling", () => {
    for (const p of ["src/app/settings/flows/page.tsx", "src/app/profile/page.tsx"]) {
      const src = read(p);
      expect(src, p).toMatch(/canSeeBilling\(officeCtx, profile\.stripe_subscription_id/);
      expect(src, p).toMatch(/showReceipts=\{showBilling\}/);
    }
  });

  it("the settings page gates the Plan and billing section on the same flag", () => {
    // It previously computed its own inline expression; the rename to a shared
    // helper had to take this call site with it or the section would render for
    // everyone (a bare function reference is always truthy).
    const src = read("src/app/settings/flows/page.tsx");
    expect(src).toMatch(/\.\.\.\(showBilling \? \[\{/);
    expect(src).not.toMatch(/\.\.\.\(canSeeBilling \? \[\{/);
  });
});
