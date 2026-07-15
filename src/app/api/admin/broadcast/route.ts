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
    sendKey,
  } = body as { segment?: Segment; subject?: string; headline?: string; message?: string; ctaLabel?: string; ctaUrl?: string; test?: boolean; sendKey?: string };

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

  // ── Campaign log ────────────────────────────────────────────────────────────
  // One row per campaign, created BEFORE sending (status 'processing') and
  // finalized after. `sendKey` is generated once per confirm dialog on the
  // client, so a double-click or a retried request can't send (or log) twice.
  // If the table hasn't been migrated yet (admin-email-log.sql), sending still
  // works — history is simply unavailable, and the UI says so.
  let campaignId: string | null = null;
  {
    const { data: created, error: campErr } = await admin
      .from("admin_email_campaigns")
      .insert({
        idempotency_key: sendKey || null,
        sent_by: adminUser.email ?? "admin",
        segment,
        subject,
        headline,
        body: message,
        cta_label: ctaLabel,
        cta_url: ctaUrl,
        intended_count: profiles?.length ?? 0,
      })
      .select("id")
      .single();
    if (campErr?.code === "23505" && sendKey) {
      // Same sendKey already used — this exact campaign was (or is being) sent.
      const { data: existing } = await admin
        .from("admin_email_campaigns")
        .select("sent_count, skipped_count, status")
        .eq("idempotency_key", sendKey)
        .maybeSingle();
      return NextResponse.json({
        duplicate: true,
        sent: existing?.sent_count ?? 0,
        skipped: existing?.skipped_count ?? 0,
        status: existing?.status ?? "processing",
        errors: [],
      });
    }
    campaignId = (created?.id as string | null) ?? null;
  }

  // Best-effort per-recipient outcome row; tolerates a pre-migration schema.
  async function logRecipient(row: { user_id: string | null; email: string; status: string; resend_id?: string | null; error?: string | null }) {
    const full = { type: "marketing", subject, campaign_id: campaignId, ...row };
    const { error: e1 } = await admin.from("email_logs").insert(full);
    if (e1) {
      // campaign_id / error / status columns may not exist yet — log what we can.
      await admin.from("email_logs").insert({ user_id: row.user_id, email: row.email, type: "marketing", subject, resend_id: row.resend_id ?? null }).then(() => {}, () => {});
    }
  }

  // Send to the ACCOUNT (auth) email of each user, not profiles.email (which can
  // be the card's public contact address). One listUsers page → id→auth-email map.
  const authEmails = await getAccountEmailMap();

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const profile of profiles ?? []) {
    const recipient = authEmails.get(profile.id) ?? profile.email;
    if (!recipient) {
      skipped++;
      if (campaignId) await logRecipient({ user_id: profile.id, email: "(no email address)", status: "skipped", error: "No account email address" });
      continue;
    }

    const { data: prefs } = await admin
      .from("email_preferences")
      .select("marketing_emails, unsubscribe_token")
      .eq("user_id", profile.id)
      .single();

    if (prefs?.marketing_emails === false) {
      skipped++;
      if (campaignId) await logRecipient({ user_id: profile.id, email: recipient, status: "skipped", error: "Unsubscribed from marketing" });
      continue;
    }

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
      if (sendErr) {
        failed++;
        errors.push(`${recipient}: ${sendErr.message}`);
        await logRecipient({ user_id: profile.id, email: recipient, status: "failed", error: sendErr.message });
        continue;
      }

      await logRecipient({ user_id: profile.id, email: recipient, status: "sent", resend_id: emailData?.id ?? null });

      sent++;
    } catch (e) {
      failed++;
      errors.push(`${recipient}: ${e}`);
      await logRecipient({ user_id: profile.id, email: recipient, status: "failed", error: String(e).slice(0, 500) });
    }
  }

  // Finalize the campaign: Sent (no failures), Partially sent, or Failed.
  if (campaignId) {
    const status = failed === 0 ? "sent" : sent === 0 ? "failed" : "partial";
    await admin
      .from("admin_email_campaigns")
      .update({ sent_count: sent, failed_count: failed, skipped_count: skipped, status, completed_at: new Date().toISOString() })
      .eq("id", campaignId);
  }

  return NextResponse.json({ sent, skipped, failed, errors });
}
