import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import UpgradeClient from "./UpgradeClient";
import { isPaidPlan } from "@/lib/plan";
import { isProTrialEligible } from "@/lib/trial-eligibility";

export const metadata = { title: "Upgrade — SwiftCard" };

// The IN-PRODUCT upgrade screen, for someone already using SwiftCard on Free.
//
// Deliberately not /pricing: someone inside the product has already chosen
// SwiftCard, so the Free column they're already on isn't shown. The 14-day Pro
// trial IS offered here (owner decision, Aug 2026 — it previously was a
// marketing-site-only acquisition offer): every Pro entry point carries the
// same trial for FIRST-TIME subscribers. Eligibility is resolved server-side
// against Stripe's own subscription history — the same check the checkout API
// enforces — so a user who has ever subscribed before sees the honest
// start-and-pay button instead of a trial promise checkout would not honor.
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
    .select("plan, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  // Already paying → nothing to sell. Billing settings is where they change or
  // cancel a plan they already have.
  const plan = (profile?.plan as string) ?? "free";
  if (isPaidPlan(plan)) redirect("/settings/flows?billing=1#billing");

  const trialEligible = await isProTrialEligible(profile?.stripe_customer_id as string | null);

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
      <UpgradeClient trialEligible={trialEligible} />
    </main>
  );
}
