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
    .select("username, plan, stripe_subscription_id, customization")
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

  // Every card username owned by this account (cards table + legacy profile card).
  const { data: cards } = await admin.from("cards").select("username").eq("user_id", user.id);
  const usernames = Array.from(
    new Set(
      [...(cards ?? []).map((c) => c.username as string), profile.username as string].filter(Boolean)
    )
  );

  // Remove the account's data (best-effort — ignore tables that may not exist).
  await admin.from("cards").delete().eq("user_id", user.id);
  if (usernames.length) {
    await admin.from("leads").delete().in("card_owner", usernames);
    await admin.from("card_views").delete().in("username", usernames);
    await admin.from("analytics_events").delete().in("username", usernames);
    await admin.from("card_events").delete().in("card_owner_username", usernames);
  }
  await admin.from("notifications").delete().eq("user_id", user.id);

  // Soft-delete the account: keep the profile row + auth user so this email can NEVER
  // be used to sign up again (whether the account is live or deleted). Record the
  // exit-survey answer so we can learn why people leave.
  await admin
    .from("profiles")
    .update({
      plan: "free",
      name: "", title: "", company: "", phone: "", website: "",
      linkedin: "", instagram: "", twitter: "", tiktok: "", logo_url: null,
      customization: {
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
