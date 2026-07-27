import { cache } from "react";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { canViewOfficeAdmin } from "@/lib/office-roles";
import MobileNav from "@/components/MobileNav";

// Server wrapper for the mobile tab bar: decides ONCE per request whether this
// user gets the Admin tab (office owners/managers) and hands the flag to the
// client bar. Exists because the desktop navbar's "Admin" link lives in a
// `hidden md:flex` section — on a phone, an Office admin previously had NO way
// into /office/admin at all.
//
// cache(): several pages render this in the same request tree; the role
// resolution (profiles read + office context) must run once, not per mount.
const resolveShowAdmin = cache(async (): Promise<boolean> => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await getAdminSupabase()
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.plan !== "enterprise") return false; // cheap pre-check, same as canViewOfficeAdmin's first line
    return await canViewOfficeAdmin(user.id, profile.plan);
  } catch {
    // Any hiccup → just render the bar without the Admin tab; the desktop nav
    // and direct URL still work.
    return false;
  }
});

// `showAdmin` lets a page that ALREADY resolved this (dashboard, contacts,
// share, settings all compute it for their desktop nav) hand it over, skipping a
// duplicate auth.getUser() round trip plus a profiles read on every render.
// Omitted → resolves it itself, so callers that don't have it still work.
export default async function MobileNavGate({ showAdmin }: { showAdmin?: boolean }) {
  const resolved = showAdmin ?? (await resolveShowAdmin());
  return <MobileNav showAdmin={resolved} />;
}
