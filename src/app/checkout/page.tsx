import { Suspense } from "react";
import CheckoutClient from "./CheckoutClient";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isProTrialEligible } from "@/lib/trial-eligibility";
import { trialHistoryFor } from "@/lib/trial-ledger";

// The single confirmation step between picking a plan and Stripe. It preserves
// the exact selection (plan, interval, seats) in the URL so it survives login,
// signup, OAuth, email verification, refresh, back/forward, and a canceled or
// failed checkout — the user never has to re-choose (spec §1). It shows the
// required pre-payment order summary, then continues to Stripe. A logged-out
// visitor is sent through account creation and auto-resumed here afterward.
//
// Trial eligibility is resolved HERE, with the same helper and history the
// checkout API enforces with, so the order summary can never promise a free
// trial the Stripe session will not create (a returning person, a second
// account, an email that has trialled before). Signed out → eligible, the
// same default the API applies to a brand-new account.
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  let trialEligible = true;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await getAdminSupabase()
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();
      trialEligible = await isProTrialEligible(
        (profile?.stripe_customer_id as string | null) ?? null,
        undefined,
        await trialHistoryFor(user.id, user.email),
      );
    }
  } catch {
    // Fail open, like the helper itself: the API still decides the session.
  }

  return (
    <main className="sc-app min-h-screen bg-gray-950 flex items-center justify-center px-5 py-12">
      <Suspense fallback={<div className="text-gray-500 text-sm">Loading…</div>}>
        <CheckoutClient trialEligible={trialEligible} />
      </Suspense>
    </main>
  );
}
