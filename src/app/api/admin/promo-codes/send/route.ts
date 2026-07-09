import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { promoEmail, unsubUrl } from "@/lib/email-templates";
import { requireAdmin } from "@/lib/admin";
import { getMarketingFrom } from "@/lib/resend-domain";

// POST /api/admin/promo-codes/send — email a promo code to targeted users.
// Same session-based admin gate as the rest of the console.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    code,            // required: promo code string
    headline,        // email subject / h1
    message,         // body copy
    segment = "free", // "free" | "pro" | "all"
  } = body;

  if (!code || !headline || !message) {
    return NextResponse.json({ error: "code, headline, message required" }, { status: 400 });
  }

  const admin = getAdminSupabase();

  // Look up the promo code
  const { data: promo, error: promoErr } = await admin
    .from("promo_codes")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("active", true)
    .single();

  if (promoErr || !promo) {
    return NextResponse.json({ error: "Promo code not found or inactive" }, { status: 404 });
  }

  const discountText =
    promo.discount_type === "percent"
      ? `${promo.discount_percent}% off your first month of SwiftCard Pro`
      : `$${((promo.discount_amount ?? 0) / 100).toFixed(2)} off your upgrade`;

  // Fetch target users
  let q = admin.from("profiles").select("id, name, email");
  if (segment === "free") q = q.eq("plan", "free");
  else if (segment === "pro") q = q.in("plan", ["pro", "enterprise"]);
  const { data: profiles } = await q;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = await getMarketingFrom();
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

    const template = promoEmail({
      firstName,
      code: promo.code,
      discountText,
      headline,
      body: message,
      unsubscribeUrl: unsubUrl(token),
    });

    try {
      const { data: emailData, error: sendErr } = await resend.emails.send({
        ...template,
        from,
        to: profile.email,
        headers: { "List-Unsubscribe": `<${unsubUrl(token)}>` },
      });
      if (sendErr) { errors.push(`${profile.email}: ${sendErr.message}`); continue; }

      await admin.from("email_logs").insert({
        user_id: profile.id,
        email: profile.email,
        type: "promo",
        subject: template.subject,
        resend_id: emailData?.id,
      });

      sent++;
    } catch (e) {
      errors.push(`${profile.email}: ${e}`);
    }
  }

  return NextResponse.json({ sent, skipped, errors });
}
