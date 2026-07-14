import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// Stripe redirects here after a successful payment. Its ONLY job is to route the
// buyer into the correct next step — it never provisions the plan (the webhook
// does that, verified server-side) so a refresh or a delayed webhook can't
// create duplicate cards/organizations/memberships (spec §3).
//
// Rules:
//   • No card yet  → send them into Create-Your-Card first (Pro and Office both
//     require a card; the Office owner's card is seat 1). We pass postcheckout so
//     the wizard routes to the Office dashboard (office) or the dashboard (pro).
//   • Has a card   → Office → /office, Pro → /dashboard.
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const isOffice = plan === "office";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Session lost between Stripe and here — sign in and come back.
    redirect(`/login?next=${encodeURIComponent(`/checkout/success?plan=${isOffice ? "office" : "pro"}`)}`);
  }

  const admin = getAdminSupabase();
  const { count } = await admin
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id);

  if ((count ?? 0) === 0) {
    // Must create a card before continuing — Office owner's card is seat 1.
    redirect(`/cards/new?add=1&postcheckout=${isOffice ? "office" : "pro"}`);
  }

  redirect(isOffice ? "/office/admin" : "/dashboard?upgraded=true&welcome=1");
}
