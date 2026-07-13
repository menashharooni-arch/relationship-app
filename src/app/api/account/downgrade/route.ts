import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// User-initiated downgrade from Pro to Free — offered as an alternative to
// deleting the account. Cancels the Stripe subscription (so billing stops) and
// moves the account to Free, keeping the user's cards and contacts. If the
// Stripe cancel fails we do NOT flip the plan, so the user can never end up
// showing as Free while still being charged.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id, customization")
    .eq("id", user.id)
    .single();

  // Only an individual Pro account can self-downgrade here. Office/enterprise
  // (teams with seats) must be managed from the office settings.
  if (profile?.plan !== "pro") {
    return NextResponse.json({ error: "Only Pro accounts can downgrade here." }, { status: 400 });
  }

  // Stop billing first. A failed cancel must block the downgrade.
  let subCleared = false;
  if (profile.stripe_subscription_id) {
    try {
      const { getStripe } = await import("@/lib/stripe");
      await getStripe().subscriptions.cancel(profile.stripe_subscription_id as string);
      subCleared = true;
    } catch (e) {
      console.error("[account downgrade] Stripe cancel failed:", e instanceof Error ? e.message : e);
      return NextResponse.json(
        { error: "Couldn't cancel your subscription right now. Please try again in a moment." },
        { status: 502 },
      );
    }
  }

  const cust = { ...((profile.customization as Record<string, unknown>) ?? {}) };
  delete cust._paymentFailedAt;

  const { error } = await admin
    .from("profiles")
    .update({
      plan: "free",
      plan_expires_at: null,
      customization: cust,
      ...(subCleared ? { stripe_subscription_id: null } : {}),
    })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
