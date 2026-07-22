import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

export const metadata = { title: "Create your card — SwiftCard" };

// The employee's landing spot right after accepting a team invite used to be a
// simplified five-field form (TeamCardSetup). Owner decision (Jul 2026): team
// members build their card in the SAME 4-step wizard as everyone else —
// Card info → Card design → Socials → Social design — where the wizard's
// office context locks the branding half (company, logo, website, phone, fax,
// address as "Managed by your organization") and locks Card design when the
// admin turned that on. This page survives only as a redirect so old invite
// emails and bookmarks still land somewhere sensible.
export default async function TeamWelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/welcome/team");

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, office_id")
    .eq("id", user.id)
    .maybeSingle();

  // Not on a team → this page isn't for them.
  if (!profile?.office_id) redirect("/dashboard");

  // Already built a card (e.g. they had an account before joining) → nothing to
  // set up; the join API already re-branded their existing cards.
  const { count } = await admin
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) > 0) redirect("/dashboard");

  redirect("/cards/new?add=1");
}
