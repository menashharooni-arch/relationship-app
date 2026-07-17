import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isRateLimited } from "@/lib/rate-limit";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { officeSubUserBlockMessage } from "@/lib/office-roles";
import { revokeAppleTokensOnDelete } from "@/lib/apple-revoke";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Per-user throttle: authenticated but previously uncapped (cost/abuse guard).
  if (await isRateLimited(`account-delete:${user.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests — please wait a moment and try again." }, { status: 429 });
  }


  // An office sub-user's account is company-managed: soft-deleting it would
  // orphan a paid seat and their branded card. They leave via the team admin
  // (Remove member), which cleanly unwinds the seat, plan, and branding.
  const blocked = await officeSubUserBlockMessage(user.id, {
    message: "Your account is part of your organization's team. Ask your Office admin to remove you from the team instead.",
  });
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : "";
  const comment = typeof body.comment === "string" ? body.comment.slice(0, 1000) : "";

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id, customization")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "No account" }, { status: 404 });

  // Cancel any active subscription so the user stops being billed.
  if (profile.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.cancel(profile.stripe_subscription_id);
    } catch {
      /* ignore */
    }
  }

  // Soft-delete: the account and its cards/contacts are hidden immediately, but kept
  // for a 1-month reopen window. The auth user + profile row stay so the email can
  // never be reused. After the grace period it's permanently gone (reopen denied).
  const customization = (profile.customization as Record<string, unknown> | null) ?? {};
  await admin
    .from("profiles")
    .update({
      plan: "free",
      customization: {
        ...customization,
        _deleted: true,
        _deletion: { reason, comment, plan: profile.plan, at: new Date().toISOString() },
      },
    })
    .eq("id", user.id);

  // Sign in with Apple (requirement 6.2): if this account was created with an
  // Apple identity, revoke its Apple tokens. Best-effort and fully guarded — it
  // never blocks deletion, and it's a no-op for every current account (no user
  // has an Apple identity yet, and the Apple env vars aren't set).
  try {
    await revokeAppleTokensOnDelete(user);
  } catch {
    /* never block deletion */
  }

  // End the session.
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true });
}
