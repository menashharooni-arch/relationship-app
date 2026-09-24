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
//     the wizard knows the card is part of a purchase.
//   • Has a card   → the caller's `next`, else /dashboard with the new-account
//     tour — Office included. An Office owner lands on THEIR dashboard first
//     and reaches the team console from its Admin tab, where the admin tour is
//     offered (owner, 2026-09-22: never straight into the admin page).
export const dynamic = "force-dynamic";

const SAFE_PATH = /^\/[a-zA-Z0-9?=&_.\-/]*$/;
const WELCOME = "/dashboard?upgraded=true&welcome=1";
// An EXISTING account that upgrades is not a new account. Every purchase used
// to land on WELCOME, and welcome=1 means "just created": someone on Free for
// months who bought Pro got "Your account is ready!" and the whole first-run
// tour. New accounts (created in the last day — e.g. sign up, pick Pro on
// /pricing, build the card, pay) still get WELCOME and the tour.
const UPGRADED = "/dashboard?upgraded=true";
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;
function isNewAccount(createdAt: string | undefined): boolean {
  const createdMs = createdAt ? Date.parse(createdAt) : NaN;
  // Unknown age → treat as new: an extra tour beats a missing one.
  return !Number.isFinite(createdMs) || Date.now() - createdMs < NEW_ACCOUNT_MS;
}

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
  // Office also waits for its office ROW: the webhook writes the plan first
  // and creates the office a moment later, and /office/admin in that gap
  // showed a new owner the "Name your team" form (2026-09-16 audit).
  let officeReady = true;
  if (isOffice && isOfficePlan(profile?.plan)) {
    const { data: officeRow } = await admin.from("offices").select("id").eq("owner_id", user!.id).limit(1).maybeSingle();
    officeReady = !!officeRow;
  }
  const settled = (isOffice ? isOfficePlan(profile?.plan) : isPaidPlan(profile?.plan)) && officeReady;

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
    const planLanded = isOffice ? isOfficePlan(profile?.plan) : isPaidPlan(profile?.plan);
    const safeNextEarly = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && SAFE_PATH.test(next) ? next : WELCOME;
    return <AwaitingPlan planName={isOffice ? "Office" : "Pro"} fallbackHref={planLanded ? safeNextEarly : undefined} />;
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
  const newAccount = isNewAccount(user!.created_at);
  redirect(safeNext ?? (newAccount ? WELCOME : UPGRADED));
}
