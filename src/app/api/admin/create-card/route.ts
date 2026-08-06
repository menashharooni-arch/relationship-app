import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin";
import { ensureEmailPreferences } from "@/lib/email-prefs";
import { slugTaken } from "@/lib/username";
import { sendRawEmail } from "@/lib/messaging";
import { getMarketingFrom } from "@/lib/resend-domain";
import { escapeHtml, safeUrlAttr } from "@/lib/escape";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, company, title, phone, username, plan = "pro", template = "classic-pro", accentColor } = await req.json();

  if (!name || !email || !username) {
    return NextResponse.json({ error: "name, email, and username are required" }, { status: 400 });
  }
  // Fail fast on a malformed email — the auth user would be created with it
  // and the recovery link would silently never arrive.
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Validate username
  if (!/^[a-z0-9-]+$/.test(username)) {
    return NextResponse.json({ error: "Username must be lowercase letters, numbers, and hyphens only" }, { status: 400 });
  }

  // Same enums set-plan / users/[id] enforce — a typo'd plan string must not
  // land in profiles.plan (plan gating reads it everywhere).
  if (!["free", "pro", "enterprise"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (!["classic-pro", "modern-bold", "photo-first", "local-business", "luxury-minimal", "custom"].includes(template)) {
    return NextResponse.json({ error: "Invalid template" }, { status: 400 });
  }

  const admin = getAdminSupabase();

  // Check the slug across BOTH namespaces. This checked `profiles` only, while
  // card slugs and profile handles share one public namespace (/card/<slug>
  // resolves against either). So an admin who picked a username matching an
  // existing CARD slug sailed past this check, the follow-on card insert
  // collided on the unique constraint — unchecked, with no uniqueness fallback
  // — and the console reported success. The result was an account with no card
  // at all, handed a URL that serves a stranger's card.
  if (await slugTaken(admin, username)) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  // Create the auth user — Supabase will send a magic link / password reset so the business owner can log in
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name },
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "Failed to create user" }, { status: 500 });
  }

  const newUserId = authData.user.id;

  // Insert profile
  const { error: profileError } = await admin.from("profiles").insert({
    id: newUserId,
    username,
    name,
    email,
    company: company || null,
    title: title || null,
    phone: phone || null,
    plan,
    template,
    customization: accentColor ? { accentColor } : {},
  });

  if (profileError) {
    // Rollback auth user if profile insert fails
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Same as the signup path: mint the unsubscribe token with the account, or
  // this user can never be sent marketing mail with a working opt-out.
  await ensureEmailPreferences(newUserId, admin);

  // generateLink GENERATES a link for a custom mail provider — it does not
  // send anything. Its result was discarded, so every account provisioned from
  // /admin (email already confirmed, no password set) was unreachable by its
  // owner while the console reported success. Generate it, then actually mail
  // it ourselves.
  let loginEmailed = false;
  let setupLink: string | null = null;
  try {
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${APP_URL}/reset-password` },
    });
    setupLink = linkData?.properties?.action_link ?? null;
    if (linkErr) console.error("[admin create-card] generateLink failed:", linkErr.message);

    if (setupLink) {
      const result = await sendRawEmail({
        to: email,
        subject: "Your SwiftCard account is ready",
        fromAddress: await getMarketingFrom(),
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;font-size:15px;line-height:1.7;max-width:560px;margin:0 auto;padding:24px 16px;">
  <p style="margin:0 0 16px;">Hi ${escapeHtml(String(name).split(" ")[0] || "there")},</p>
  <p style="margin:0 0 16px;">Your SwiftCard account has been set up for you. Choose a password to get in:</p>
  <p style="margin:0 0 24px;"><a href="${safeUrlAttr(setupLink)}" style="display:inline-block;background:#1D4ED8;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px;">Set your password</a></p>
  <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">Your card is live at <a href="${safeUrlAttr(`${APP_URL}/card/${username}`)}" style="color:#2563eb;">${escapeHtml(`swiftcard.me/card/${username}`)}</a>.</p>
</div>`,
      });
      loginEmailed = result === "sent";
      if (!loginEmailed) console.error("[admin create-card] setup email not sent:", result);
    }
  } catch (e) {
    console.error("[admin create-card] setup email threw:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    success: true,
    cardUrl: `${APP_URL}/card/${username}`,
    userId: newUserId,
    // Reported so the console can stop claiming success it can't vouch for,
    // and hand the admin the link to pass on by hand.
    loginEmailed,
    setupLink: loginEmailed ? null : setupLink,
  });
}
