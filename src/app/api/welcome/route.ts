import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { welcomeEmail, unsubUrl } from "@/lib/email-templates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getAdminSupabase();

    const { data: profile } = await admin
      .from("profiles")
      .select("name, email, username")
      .eq("id", user.id)
      .single();

    // Owner mail goes to the ACCOUNT (auth) email, not profiles.email (which can
    // be the card's public contact address).
    const accountEmail = user.email;
    if (!profile || !accountEmail) return NextResponse.json({ error: "No profile" }, { status: 404 });

    // Ensure email_preferences row exists for this user
    await admin
      .from("email_preferences")
      .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });

    const { data: prefsRow } = await admin
      .from("email_preferences")
      .select("unsubscribe_token")
      .eq("user_id", user.id)
      .single();

    const firstName = profile.name?.split(" ")[0] || "there";
    const cardUrl = `${APP_URL}/card/${profile.username}`;
    const token = prefsRow?.unsubscribe_token ?? "";

    const template = welcomeEmail({
      firstName,
      cardUrl,
      unsubscribeUrl: unsubUrl(token),
    });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data: sent } = await resend.emails.send({
      ...template,
      to: accountEmail,
    });

    await admin.from("email_logs").insert({
      user_id: user.id,
      email: accountEmail,
      type: "welcome",
      subject: template.subject,
      resend_id: sent?.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Welcome email error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
