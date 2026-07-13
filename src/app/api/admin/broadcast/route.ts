import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin";
import { marketingEmail, unsubUrl } from "@/lib/email-templates";
import { getMarketingFrom } from "@/lib/resend-domain";
import { getAccountEmailMap } from "@/lib/account-email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

type Segment = "all" | "free" | "pro" | "office";

function segmentQuery(admin: ReturnType<typeof getAdminSupabase>, segment: Segment) {
  let q = admin.from("profiles").select("id, name, email");
  if (segment === "free") q = q.eq("plan", "free");
  else if (segment === "pro") q = q.in("plan", ["pro", "enterprise"]);
  else if (segment === "office") q = q.eq("plan", "enterprise");
  return q;
}

// GET: live recipient counts per segment (shown in the composer before sending).
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = getAdminSupabase();

  const { data: profiles, error } = await admin.from("profiles").select("id, email, plan, customization");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const live = (profiles ?? []).filter((p) => p.email && !((p.customization as { _deleted?: boolean } | null)?._deleted));
  const counts = {
    all: live.length,
    free: live.filter((p) => p.plan === "free" || !p.plan).length,
    pro: live.filter((p) => p.plan === "pro" || p.plan === "enterprise").length,
    office: live.filter((p) => p.plan === "enterprise").length,
  };

  // How many have opted out of marketing (skipped at send time).
  let optedOut = 0;
  const { data: prefs, error: prefErr } = await admin.from("email_preferences").select("user_id, marketing_emails").eq("marketing_emails", false);
  if (!prefErr) optedOut = (prefs ?? []).length;

  return NextResponse.json({ counts, optedOut, emailTablesReady: !prefErr });
}

// POST: send a marketing email to a segment — or, with test:true, ONLY to the
// admin themselves so the email can be checked before blasting everyone.
export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    segment = "all",
    subject,
    headline,
    message,
    ctaLabel = "Open SwiftCard",
    ctaUrl = APP_URL,
    test = false,
  } = body as { segment?: Segment; subject?: string; headline?: string; message?: string; ctaLabel?: string; ctaUrl?: string; test?: boolean };

  if (!subject || !headline || !message) {
    return NextResponse.json({ error: "subject, headline, message required" }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const resend = new Resend(process.env.RESEND_API_KEY);
  // Branded from-address once the sending domain is verified; sandbox fallback until then.
  const from = await getMarketingFrom();

  // Test mode: one email, to the admin, clearly labeled. Nothing else sent.
  if (test) {
    const template = marketingEmail({
      firstName: "there",
      subject: `[TEST] ${subject}`,
      headline,
      body: message,
      ctaLabel,
      ctaUrl,
      unsubscribeUrl: unsubUrl(""),
    });
    try {
      const { error } = await resend.emails.send({ ...template, from, subject: `[TEST] ${subject}`, to: adminUser.email! });
      if (error) return NextResponse.json({ error: `Test send failed: ${error.message}` }, { status: 500 });
      return NextResponse.json({ test: true, sent: 1, to: adminUser.email });
    } catch (e) {
      return NextResponse.json({ error: `Test send failed: ${e}` }, { status: 500 });
    }
  }

  const { data: profiles, error } = await segmentQuery(admin, segment);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send to the ACCOUNT (auth) email of each user, not profiles.email (which can
  // be the card's public contact address). One listUsers page → id→auth-email map.
  const authEmails = await getAccountEmailMap();

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const profile of profiles ?? []) {
    const recipient = authEmails.get(profile.id) ?? profile.email;
    if (!recipient) { skipped++; continue; }

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
      const { data: emailData, error: sendErr } = await resend.emails.send({
        ...template,
        from,
        to: recipient,
        headers: { "List-Unsubscribe": `<${unsubUrl(token)}>` },
      });
      if (sendErr) { errors.push(`${recipient}: ${sendErr.message}`); continue; }

      await admin.from("email_logs").insert({
        user_id: profile.id,
        email: recipient,
        type: "marketing",
        subject,
        resend_id: emailData?.id,
      });

      sent++;
    } catch (e) {
      errors.push(`${recipient}: ${e}`);
    }
  }

  return NextResponse.json({ sent, skipped, errors });
}
