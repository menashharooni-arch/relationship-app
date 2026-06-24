import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { marketingEmail, unsubUrl } from "@/lib/email-templates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) return null;
  return user;
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    segment = "all",   // "free" | "pro" | "all"
    subject,
    headline,
    message,
    ctaLabel = "Open SwiftCard",
    ctaUrl = APP_URL,
  } = body;

  if (!subject || !headline || !message) {
    return NextResponse.json({ error: "subject, headline, message required" }, { status: 400 });
  }

  const admin = getAdminSupabase();

  let profilesQuery = admin.from("profiles").select("id, name, email");
  if (segment === "free") profilesQuery = profilesQuery.eq("plan", "free");
  else if (segment === "pro") profilesQuery = profilesQuery.in("plan", ["pro", "enterprise"]);

  const { data: profiles, error } = await profilesQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const profile of profiles ?? []) {
    if (!profile.email) { skipped++; continue; }

    const { data: prefs } = await admin
      .from("email_preferences")
      .select("marketing_emails, unsubscribe_token")
      .eq("user_id", profile.id)
      .single();

    if (prefs?.marketing_emails === false) { skipped++; continue; }

    const firstName = profile.name?.split(" ")[0] || "there";
    const token = prefs?.unsubscribe_token ?? "";

    const template = marketingEmail({
      firstName,
      subject,
      headline,
      body: message,
      ctaLabel,
      ctaUrl,
      unsubscribeUrl: unsubUrl(token),
    });

    try {
      const { data: emailData } = await resend.emails.send({
        ...template,
        to: profile.email,
        headers: { "List-Unsubscribe": `<${unsubUrl(token)}>` },
      });

      await admin.from("email_logs").insert({
        user_id: profile.id,
        email: profile.email,
        type: "marketing",
        subject,
        resend_id: emailData?.id,
      });

      sent++;
    } catch (e) {
      errors.push(`${profile.email}: ${e}`);
    }
  }

  return NextResponse.json({ sent, skipped, errors });
}
