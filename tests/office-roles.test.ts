import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { roleHasCapability, isAssignableRole, type OfficeRole, type Capability } from "@/lib/office-roles";

const ALL_CAPS: Capability[] = [
  "manage_billing", "manage_seats", "invite_members", "remove_members",
  "manage_roles", "manage_branding", "view_org_analytics",
];

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

  it("rejects the legacy 'member' value the column used to default to", () => {
    // office_members.role defaulted to 'member' for a long time, which is not
    // an OfficeRole. The default is now 'employee' and the historical rows were
    // rewritten, but any that survive (a restored backup, an external insert)
    // must keep failing this check so resolveOfficeContext falls back to
    // employee rather than being handed an unknown role it might honour.
    expect(isAssignableRole("member")).toBe(false);
  });
});

// Two halves of the same guarantee: an invited sub-user ends up an EMPLOYEE,
// and never accidentally something with capabilities.
describe("invited members land on a known, least-privilege role", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("the invite route writes the role explicitly instead of leaning on the column default", () => {
    // Relying on the DB default is what let 'member' — a value the capability
    // map has never known — become every member's stored role. Both insert
    // paths (with and without expires_at) must name the role.
    const src = read("src/app/api/office/invite/route.ts");
    const inserts = src.split(".insert(").slice(1);
    const memberInserts = inserts.filter((chunk) => chunk.slice(0, 200).includes("invite_email"));
    expect(memberInserts.length).toBeGreaterThan(0);
    for (const chunk of memberInserts) {
      expect(chunk.slice(0, 300)).toContain('role: "employee"');
    }
  });

  it("an unrecognised stored role still degrades to employee, not to blank privileges", () => {
    // The safety net itself. If this coercion is ever refactored away, a row
    // carrying a legacy or hand-edited role would flow into roleHasCapability
    // unchecked — so pin that the fallback exists AND that its target is the
    // no-capability role.
    expect(read("src/lib/office-roles.ts")).toMatch(/isAssignableRole\(rawRole\)\s*\?\s*rawRole\s*:\s*"employee"/);
    for (const c of ALL_CAPS) expect(roleHasCapability("employee", c)).toBe(false);
  });
});
