import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { isPaidPlan } from "@/lib/plan";
import WelcomePlan from "@/components/WelcomePlan";

// Post-signup onboarding step. A brand-new account lands here right after its
// first card is claimed (GuestDraftClaim → /welcome?card=slug): turn on
// notifications, then choose a plan. Already-paid or signed-out users are sent
// on so this only ever shows once, at the right moment.
export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ card?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/welcome");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  // Someone who already picked a paid plan doesn't need the plan step.
  if (isPaidPlan(profile?.plan)) redirect("/dashboard?welcome=1&tour=1");

  const cardSlug = typeof sp.card === "string" && sp.card ? sp.card : null;
  return <WelcomePlan cardSlug={cardSlug} />;
}
