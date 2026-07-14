import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOfficeBrandForUser } from "@/lib/office-brand";
import TeamCardSetup from "./TeamCardSetup";

export const metadata = { title: "Create your card — SwiftCard" };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// The employee's landing spot right after accepting a team invite: one screen,
// five fields, and their card is live. Company branding is applied server-side
// by POST /api/cards (getOfficeBrandForUser overlay), so this page only collects
// what's genuinely theirs. No plans, no upsells — their company already paid.
export default async function TeamWelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/welcome/team");

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, email, phone, office_id")
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

  const brand = await getOfficeBrandForUser(user.id).catch(() => null);

  return (
    <main className="min-h-screen bg-gray-950 px-5 py-10">
      <TeamCardSetup
        appUrl={APP_URL}
        companyName={brand?.company ?? null}
        companyLogoUrl={brand?.logoUrl ?? null}
        prefill={{
          name: (profile.name as string) || "",
          email: (profile.email as string) || user.email || "",
          phone: (profile.phone as string) || "",
        }}
      />
    </main>
  );
}
