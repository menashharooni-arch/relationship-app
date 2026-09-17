import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { isPaidPlan, isOfficePlan } from "@/lib/plan";
import AwaitingPlan from "./AwaitingPlan";

// Stripe redirects here after a successful payment. Its ONLY job is to route the
// buyer into the correct next step — it never provisions the plan (the webhook
// does that, verified server-side) so a refresh or a delayed webhook can't
// create duplicate cards/organizations/memberships (spec §3).
//
// Rules:
//   • Plan not landed yet → "Setting up…", re-checked every 2s. Stripe sends
//     the buyer back before its webhook has run, and every destination below
//     gates on the plan: /office/admin bounced a brand-new Office owner to
//     /pricing, and /dashboard bounced a new account to the plan chooser —
//     the "Office sign-up glitches" report (2026-09-16).
//   • No card yet  → send them into Create-Your-Card first (Pro and Office both
//     require a card; the Office owner's card is seat 1). We pass postcheckout so
//     the wizard routes to the Office dashboard (office) or the dashboard (pro).
//   • Has a card   → the caller's `next`, else Office → /office/admin,
//     Pro → /dashboard.
export const dynamic = "force-dynamic";

const SAFE_PATH = /^\/[a-zA-Z0-9?=&_.\-/]*$/;

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; next?: string; session_id?: string }>;
}) {
  const { plan, next, session_id } = await searchParams;
  const isOffice = plan === "office";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Session lost between Stripe and here — sign in and come back.
    const qs = new URLSearchParams({ plan: isOffice ? "office" : "pro" });
    if (next) qs.set("next", next);
    if (session_id) qs.set("session_id", session_id);
    redirect(`/login?next=${encodeURIComponent(`/checkout/success?${qs.toString()}`)}`);
  }

  const admin = getAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("plan").eq("id", user!.id).maybeSingle();
  const settled = isOffice ? isOfficePlan(profile?.plan) : isPaidPlan(profile?.plan);

  if (!settled) {
    // Only wait for a checkout that really was THIS account's and really was
    // paid. Anything else (a stale bookmark, an abandoned session) goes back to
    // choosing a plan instead of spinning forever.
    let paid = false;
    if (session_id && /^cs_[A-Za-z0-9_]+$/.test(session_id)) {
      try {
        const session = await getStripe().checkout.sessions.retrieve(session_id);
        paid = session.client_reference_id === user!.id && session.status === "complete";
      } catch { /* unknown session → treat as unpaid */ }
    }
    if (!paid) redirect("/welcome");
    return <AwaitingPlan planName={isOffice ? "Office" : "Pro"} />;
  }

  const { count } = await admin
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id);

  if ((count ?? 0) === 0) {
    // Must create a card before continuing — Office owner's card is seat 1.
    redirect(`/cards/new?add=1&postcheckout=${isOffice ? "office" : "pro"}`);
  }

  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && SAFE_PATH.test(next) ? next : null;
  redirect(safeNext ?? (isOffice ? "/office/admin" : "/dashboard?upgraded=true&welcome=1"));
}
