import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { resolveOfficeContext, roleHasCapability, type OfficeRole } from "@/lib/office-roles";
import { adoptPrimaryCardForOwner } from "@/lib/office-primary";

// ── One gate for every /office/admin page ────────────────────────────────────
// Each page in the portal needs the same three things: the caller is on Office,
// they're allowed in here, and their office row. Doing that once means a new
// page can't accidentally ship without the check.
//
// This is the OFFICE admin. The site-owner console at /admin is a separate,
// ADMIN_EMAILS-gated area that office users must never reach.

export type OfficeAdminCtx = {
  userId: string;
  email: string;
  office: Record<string, unknown> | null; // null = on Office but hasn't created one yet
  officeId: string | null;
  ownerId: string | null;
  role: OfficeRole;
  isOwner: boolean;
  caps: {
    canInvite: boolean;
    canRemove: boolean;
    canBrand: boolean;
    canManageSeats: boolean;
    canManageCards: boolean;
  };
};

export async function requireOfficeAdmin(): Promise<OfficeAdminCtx> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (!profile) redirect("/onboarding");
  if (profile.plan !== "enterprise") redirect("/pricing");

  // An Office user with no office yet is the owner-to-be (they'll see the
  // create form). A member without org-analytics access is a plain employee and
  // has no business here.
  const ctx = await resolveOfficeContext(user.id);
  const role: OfficeRole = ctx ? ctx.role : "owner";
  if (ctx && !ctx.isOwner && !roleHasCapability(role, "view_org_analytics")) redirect("/dashboard");

  // Reads go through the service-role client: the offices RLS policies are
  // mutually recursive with office_members, so a user-scoped read raises
  // "infinite recursion detected in policy for relation offices". Still pinned
  // to this caller (their own owner_id, or the office their context resolved to).
  const admin = getAdminSupabase();
  const { data: office } = ctx && !ctx.isOwner
    ? await admin.from("offices").select("*, office_members(*)").eq("id", ctx.officeId).maybeSingle()
    : await admin.from("offices").select("*, office_members(*)").eq("owner_id", user.id).maybeSingle();

  // Backfill the primary card: an office can be created by the Stripe webhook or
  // a plan change, neither of which can adopt the owner's card at the time.
  // No-ops once set — a self-heal for every creation path.
  if (office?.id && office?.owner_id) {
    try { await adoptPrimaryCardForOwner(office.id as string, office.owner_id as string); } catch { /* best-effort */ }
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    office: (office as Record<string, unknown> | null) ?? null,
    officeId: (office?.id as string | null) ?? null,
    ownerId: (office?.owner_id as string | null) ?? null,
    role,
    isOwner: ctx ? ctx.isOwner : true,
    caps: {
      canInvite: roleHasCapability(role, "invite_members"),
      canRemove: roleHasCapability(role, "remove_members"),
      canBrand: roleHasCapability(role, "manage_branding"),
      canManageSeats: roleHasCapability(role, "manage_seats"),
      canManageCards: roleHasCapability(role, "manage_member_cards"),
    },
  };
}
