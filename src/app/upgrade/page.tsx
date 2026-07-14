import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import UpgradeClient from "./UpgradeClient";

export const metadata = { title: "Upgrade — SwiftCard" };

// The IN-PRODUCT upgrade screen, for someone already using SwiftCard on Free.
//
// Deliberately not /pricing. Someone inside the product has already chosen
// SwiftCard — showing them the Free column they're already on is a no-op, and
// the 14-day trial is an acquisition offer for strangers on the marketing site,
// not for a user who's been on Free for a month. Here it's start and pay.
export default async function UpgradePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/upgrade");

  const { data: profile } = await getAdminSupabase()
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  // Already paying → nothing to sell. Billing settings is where they change or
  // cancel a plan they already have.
  const plan = (profile?.plan as string) ?? "free";
  if (plan === "pro" || plan === "enterprise") redirect("/settings/flows?billing=1#billing");

  return (
    <main className="min-h-screen bg-gray-950 px-5 py-12">
      <UpgradeClient />
    </main>
  );
}
