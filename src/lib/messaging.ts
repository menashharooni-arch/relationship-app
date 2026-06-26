import { Resend } from "resend";
import twilio from "twilio";
import { getAdminSupabase } from "@/lib/supabase-admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export type SendResult = "sent" | "not_configured" | "failed";

// ── Opt-out / suppression (STOP compliance + email unsubscribe) ─────────────
// SMS STOP must suppress that phone platform-wide (carrier requirement), so the
// suppression list is keyed by normalized contact, not by user.
export function normalizePhone(p: string): string {
  const d = (p || "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d; // match on the last 10 digits
}
function normContact(channel: "sms" | "email", contact: string): string {
  return channel === "sms" ? normalizePhone(contact) : contact.trim().toLowerCase();
}

export async function isOptedOut(channel: "sms" | "email", contact: string | null | undefined): Promise<boolean> {
  if (!contact) return false;
  try {
    const { data } = await getAdminSupabase()
      .from("message_opt_outs")
      .select("id")
      .eq("channel", channel)
      .eq("contact", normContact(channel, contact))
      .maybeSingle();
    return !!data;
  } catch {
    return false; // table missing before migration → don't block sends
  }
}

export async function addOptOut(channel: "sms" | "email", contact: string): Promise<void> {
  try {
    await getAdminSupabase()
      .from("message_opt_outs")
      .upsert({ channel, contact: normContact(channel, contact) }, { onConflict: "channel,contact" });
  } catch { /* ignore */ }
}

export async function removeOptOut(channel: "sms" | "email", contact: string): Promise<void> {
  try {
    await getAdminSupabase()
      .from("message_opt_outs")
      .delete()
      .eq("channel", channel)
      .eq("contact", normContact(channel, contact));
  } catch { /* ignore */ }
}

// Append a message to a contact's conversation thread (best-effort).
export async function logMessage(opts: {
  leadId: string;
  cardOwner?: string | null;
  direction: "out" | "in";
  channel: "sms" | "email";
  body: string;
  status?: string | null;
}): Promise<void> {
  try {
    await getAdminSupabase().from("lead_messages").insert({
      lead_id: opts.leadId,
      card_owner: opts.cardOwner ?? null,
      direction: opts.direction,
      channel: opts.channel,
      body: opts.body,
      status: opts.status ?? null,
    });
  } catch { /* table may not exist yet */ }
}

// Keep SMS bodies in plain GSM-7 so each message is 1 segment (cheapest).
// One emoji forces UCS-2 encoding → 70 chars/segment → 2-3x the cost.
export function toGsm7(input: string): string {
  return input
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\p{Extended_Pictographic}/gu, "") // strip emoji
    .replace(/[^\x00-\x7F]/g, "")               // strip remaining non-ASCII
    .replace(/\s+/g, " ")
    .trim();
}

// Branded, segment-safe SMS body. The recipient sees one shared SwiftCard
// sender; the content makes clear who it's really from + how to reach them.
export function buildSmsBody(opts: { senderName: string; company?: string | null; text: string; replyContact?: string | null }): string {
  const first = opts.senderName.split(" ")[0] || opts.senderName;
  const who = opts.company ? `${opts.senderName} from ${opts.company}` : opts.senderName;
  let body = `${who} messaged you via SwiftCard: "${opts.text}"`;
  if (opts.replyContact) body += ` Reach ${first} at ${opts.replyContact}.`;
  body = toGsm7(body);
  if (body.length > 300) body = body.slice(0, 297) + "...";
  return body;
}

// ── SMS via ONE shared SwiftCard sender (Twilio Messaging Service) ──────────
export async function sendSms(to: string, body: string): Promise<SendResult> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID, TWILIO_PHONE_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_PHONE_NUMBER)) {
    return "not_configured";
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  try {
    await client.messages.create({
      to,
      body,
      // Prefer the Messaging Service (one shared sender for ALL users, scales
      // long code → short code by config). Falls back to a single number.
      ...(TWILIO_MESSAGING_SERVICE_SID
        ? { messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID }
        : { from: TWILIO_PHONE_NUMBER! }),
    });
    return "sent";
  } catch {
    return "failed";
  }
}

function esc(v: string | null | undefined) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Send pre-built HTML (used by automations that have their own templates).
export async function sendRawEmail(opts: { to: string; subject: string; html: string; replyTo?: string | null }): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) return "not_configured";
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "SwiftCard <onboarding@resend.dev>",
      to: opts.to,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      subject: opts.subject,
      html: opts.html,
    });
    return "sent";
  } catch {
    return "failed";
  }
}

export type DeliverResult = { channel: "email" | "sms" | "none"; status: SendResult | "opted_out" | "no_contact" };

// One delivery path for BOTH conversations and automations:
// email first (free) → SMS fallback (one shared number) → respect opt-out → log to thread.
export async function deliverToLead(opts: {
  leadId: string;
  cardOwner?: string | null;
  lead: { email?: string | null; phone?: string | null; name?: string | null };
  sender: { name?: string | null; company?: string | null; phone?: string | null; email?: string | null; website?: string | null };
  text: string;                               // plain body (SMS + thread log + fallback email)
  email?: { subject: string; html: string };  // custom email template (automations); omit → branded notification
  cardUsername?: string | null;
  log?: boolean;                              // append to conversation thread (default true)
  channel?: "email" | "sms";                  // explicit channel choice; else email-first auto
}): Promise<DeliverResult> {
  const { lead, sender } = opts;
  const senderName = sender.name || "A SwiftCard user";
  const doLog = opts.log !== false;

  // Honor an explicit channel choice when that channel is available, otherwise
  // fall back to email-first auto-routing.
  let use: "email" | "sms" | "none" = "none";
  if (opts.channel === "email" && lead.email) use = "email";
  else if (opts.channel === "sms" && lead.phone) use = "sms";
  else if (lead.email) use = "email";
  else if (lead.phone) use = "sms";

  if (use === "email" && lead.email) {
    if (await isOptedOut("email", lead.email)) return { channel: "email", status: "opted_out" };
    const status = opts.email
      ? await sendRawEmail({ to: lead.email, subject: opts.email.subject, html: opts.email.html, replyTo: sender.email || null })
      : await sendBrandedEmail({ to: lead.email, senderName, company: sender.company, text: opts.text, replyTo: sender.email || null, phone: sender.phone || null, website: sender.website || null, cardUsername: opts.cardUsername });
    if (doLog && status === "sent") await logMessage({ leadId: opts.leadId, cardOwner: opts.cardOwner, direction: "out", channel: "email", body: opts.text, status });
    return { channel: "email", status };
  }

  if (use === "sms" && lead.phone) {
    if (await isOptedOut("sms", lead.phone)) return { channel: "sms", status: "opted_out" };
    const status = await sendSms(lead.phone, buildSmsBody({ senderName, company: sender.company, text: opts.text, replyContact: sender.phone || sender.email || null }));
    if (doLog && status === "sent") await logMessage({ leadId: opts.leadId, cardOwner: opts.cardOwner, direction: "out", channel: "sms", body: opts.text, status });
    return { channel: "sms", status };
  }

  return { channel: "none", status: "no_contact" };
}

// ── Branded email "message" (free; default channel when the contact has email) ─
export async function sendBrandedEmail(opts: {
  to: string;
  senderName: string;
  company?: string | null;
  text: string;
  replyTo?: string | null;
  phone?: string | null;
  website?: string | null;
  cardUsername?: string | null;
}): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) return "not_configured";
  const resend = new Resend(process.env.RESEND_API_KEY);
  const first = opts.senderName.split(" ")[0] || opts.senderName;
  const cardUrl = opts.cardUsername ? `${APP_URL}/card/${opts.cardUsername}` : null;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "SwiftCard <onboarding@resend.dev>",
      to: opts.to,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      subject: `${first} sent you a message`,
      html: `<!DOCTYPE html><html><body style="margin:0;background:#0b1020;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px 16px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="100%" style="max-width:480px;">
  <tr><td style="padding-bottom:18px;"><span style="font-size:11px;font-weight:800;letter-spacing:0.2em;color:#64748b;text-transform:uppercase;">SwiftCard</span></td></tr>
  <tr><td style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px;">
    <p style="margin:0 0 10px;font-size:13px;color:#94a3b8;">${esc(opts.senderName)}${opts.company ? ` · ${esc(opts.company)}` : ""} messaged you through SwiftCard:</p>
    <div style="background:#1e293b;border-radius:12px;padding:14px 16px;color:#f1f5f9;font-size:15px;line-height:1.5;">${esc(opts.text)}</div>
    <div style="margin-top:20px;border-top:1px solid #1f2937;padding-top:16px;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#ffffff;">${esc(opts.senderName)}</p>
      ${opts.company ? `<p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">${esc(opts.company)}</p>` : ""}
      ${opts.phone ? `<a href="tel:${esc(opts.phone)}" style="display:block;font-size:13px;color:#60a5fa;text-decoration:none;">${esc(opts.phone)}</a>` : ""}
      ${opts.replyTo ? `<a href="mailto:${esc(opts.replyTo)}" style="display:block;font-size:13px;color:#60a5fa;text-decoration:none;">${esc(opts.replyTo)}</a>` : ""}
      ${opts.website ? `<a href="${opts.website.startsWith("http") ? esc(opts.website) : "https://" + esc(opts.website)}" style="display:block;font-size:13px;color:#60a5fa;text-decoration:none;">${esc(opts.website)}</a>` : ""}
    </div>
    ${cardUrl ? `<a href="${cardUrl}" style="display:inline-block;margin-top:18px;background:#2563eb;color:#fff;text-decoration:none;padding:11px 22px;border-radius:99px;font-size:13px;font-weight:700;">Save ${esc(first)}'s contact →</a>` : ""}
  </td></tr>
  <tr><td style="padding-top:16px;"><p style="color:#475569;font-size:11px;text-align:center;margin:0;">Reply to this email to respond to ${esc(first)} directly.</p></td></tr>
</table>
</td></tr></table></body></html>`,
    });
    return "sent";
  } catch {
    return "failed";
  }
}
