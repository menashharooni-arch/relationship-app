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
export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
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
      {/* Arriving from a blocked card claim is a jarring jump unless we say why —
          and, crucially, that their card wasn't thrown away. */}
      {from === "claim" && (
        <div className="max-w-4xl mx-auto mb-6">
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3.5">
            <p className="text-amber-300 text-sm font-semibold">Your card is saved — Free covers one card</p>
            <p className="text-amber-200/70 text-xs mt-0.5 leading-relaxed">
              You already have a card on this account. Nothing was lost: the one you just built is still
              here waiting, and it goes live as soon as you upgrade.
            </p>
          </div>
        </div>
      )}
      <UpgradeClient />
    </main>
  );
}
