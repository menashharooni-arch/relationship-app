import { getAdminSupabase } from "@/lib/supabase-admin";

// ── Office roles & capabilities (spec §6/§7) ─────────────────────────────────
// Secure, SERVER-SIDE authorization. The office OWNER (offices.owner_id) is
// implicit and always has every capability. Members carry a role on
// office_members.role. Capabilities — not roles — are checked at each route, so
// the mapping lives in exactly one place.

export type OfficeRole = "owner" | "admin" | "manager" | "billing_admin" | "employee";

export type Capability =
  | "manage_billing"      // subscription, payment method, invoices, seat quantity
  | "manage_seats"        // change seat count (a billing action)
  | "invite_members"      // send/resend/revoke invitations, add members
  | "remove_members"      // remove/suspend members
  | "manage_roles"        // assign member roles
  | "manage_branding"     // company card branding + company info
  | "view_org_analytics"; // organization-wide + per-employee analytics

// Owner = superset of everything. Delegated roles get a deliberate subset.
const ROLE_CAPABILITIES: Record<OfficeRole, Capability[]> = {
  owner: ["manage_billing", "manage_seats", "invite_members", "remove_members", "manage_roles", "manage_branding", "view_org_analytics"],
  billing_admin: ["manage_billing", "manage_seats", "view_org_analytics"],
  admin: ["invite_members", "remove_members", "manage_branding", "view_org_analytics"],
  manager: ["view_org_analytics"],
  employee: [],
};

const VALID_MEMBER_ROLES: OfficeRole[] = ["admin", "manager", "billing_admin", "employee"];
export function isAssignableRole(r: string): r is OfficeRole {
  return (VALID_MEMBER_ROLES as string[]).includes(r);
}

export function roleHasCapability(role: OfficeRole, cap: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(cap) ?? false;
}

export type OfficeContext = {
  officeId: string;
  ownerId: string;
  role: OfficeRole;   // the caller's role in this office
  isOwner: boolean;
};

// Resolve the caller's office + role. A user is either the OWNER of an office,
// or an ACTIVE member of one, or neither. Returns null when they're in no office.
// A missing `role` column (pre-migration) or null role degrades to 'employee'.
export async function resolveOfficeContext(userId: string): Promise<OfficeContext | null> {
  const admin = getAdminSupabase();

  // Owner path.
  const { data: owned } = await admin.from("offices").select("id, owner_id").eq("owner_id", userId).maybeSingle();
  if (owned) {
    return { officeId: owned.id as string, ownerId: owned.owner_id as string, role: "owner", isOwner: true };
  }

  // Member path (active membership only). Select role defensively.
  const { data: member } = await admin
    .from("office_members")
    .select("office_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!member) return null;

  const rawRole = (member as { role?: string | null }).role;
  const role: OfficeRole = rawRole && isAssignableRole(rawRole) ? rawRole : "employee";

  const { data: office } = await admin.from("offices").select("owner_id").eq("id", member.office_id).maybeSingle();
  return {
    officeId: member.office_id as string,
    ownerId: (office?.owner_id as string) ?? "",
    role,
    isOwner: false,
  };
}

// Authorize: does this user have `cap` in some office? Returns the office context
// on success, or null on failure (caller returns 403). SERVER-SIDE only.
export async function requireOfficeCapability(userId: string, cap: Capability): Promise<OfficeContext | null> {
  const ctx = await resolveOfficeContext(userId);
  if (!ctx) return null;
  return roleHasCapability(ctx.role, cap) ? ctx : null;
}
