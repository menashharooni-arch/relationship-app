import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // End the session.
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true });
}
