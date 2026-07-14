import { describe, it, expect } from "vitest";
import { roleHasCapability, isAssignableRole, type OfficeRole, type Capability } from "@/lib/office-roles";

describe("roleHasCapability — the permission matrix", () => {
  it("owner has every capability", () => {
    const caps: Capability[] = ["manage_billing", "manage_seats", "invite_members", "remove_members", "manage_roles", "manage_branding", "view_org_analytics"];
    for (const c of caps) expect(roleHasCapability("owner", c)).toBe(true);
  });

  it("billing_admin manages billing/seats + analytics, but NOT members/roles/branding", () => {
    expect(roleHasCapability("billing_admin", "manage_billing")).toBe(true);
    expect(roleHasCapability("billing_admin", "manage_seats")).toBe(true);
    expect(roleHasCapability("billing_admin", "view_org_analytics")).toBe(true);
    expect(roleHasCapability("billing_admin", "invite_members")).toBe(false);
    expect(roleHasCapability("billing_admin", "manage_roles")).toBe(false);
    expect(roleHasCapability("billing_admin", "manage_branding")).toBe(false);
  });

  it("admin manages members/branding + analytics, but NOT billing/seats/roles", () => {
    expect(roleHasCapability("admin", "invite_members")).toBe(true);
    expect(roleHasCapability("admin", "remove_members")).toBe(true);
    expect(roleHasCapability("admin", "manage_branding")).toBe(true);
    expect(roleHasCapability("admin", "view_org_analytics")).toBe(true);
    expect(roleHasCapability("admin", "manage_billing")).toBe(false);
    expect(roleHasCapability("admin", "manage_seats")).toBe(false);
    expect(roleHasCapability("admin", "manage_roles")).toBe(false);
  });

  it("manager can only view analytics", () => {
    expect(roleHasCapability("manager", "view_org_analytics")).toBe(true);
    for (const c of ["manage_billing", "manage_seats", "invite_members", "remove_members", "manage_roles", "manage_branding"] as Capability[]) {
      expect(roleHasCapability("manager", c)).toBe(false);
    }
  });

  it("employee has NO capabilities", () => {
    for (const c of ["manage_billing", "manage_seats", "invite_members", "remove_members", "manage_roles", "manage_branding", "view_org_analytics"] as Capability[]) {
      expect(roleHasCapability("employee", c)).toBe(false);
    }
  });

  it("only the owner can manage roles", () => {
    const roles: OfficeRole[] = ["billing_admin", "admin", "manager", "employee"];
    for (const r of roles) expect(roleHasCapability(r, "manage_roles")).toBe(false);
    expect(roleHasCapability("owner", "manage_roles")).toBe(true);
  });
});

describe("isAssignableRole", () => {
  it("accepts the four member roles, rejects owner and junk", () => {
    expect(isAssignableRole("admin")).toBe(true);
    expect(isAssignableRole("manager")).toBe(true);
    expect(isAssignableRole("billing_admin")).toBe(true);
    expect(isAssignableRole("employee")).toBe(true);
    expect(isAssignableRole("owner")).toBe(false); // owner is not assignable to a member
    expect(isAssignableRole("superadmin")).toBe(false);
    expect(isAssignableRole("")).toBe(false);
  });
});
