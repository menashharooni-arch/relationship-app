import { Resend } from "resend";
import twilio from "twilio";
import { getAdminSupabase } from "@/lib/supabase-admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export type SendResult = "sent" | "not_configured" | "failed";

// Build the From header: the per-sender display name on the ONE verified address
// (RESEND_FROM_EMAIL), so recipients see the person who messaged them — not a
// generic "SwiftCard" — while every user still sends from the same verified domain.
function senderFrom(displayName: string | null | undefined): string {
  const configured = process.env.RESEND_FROM_EMAIL || "SwiftCard <onboarding@resend.dev>";
  const addr = configured.match(/<([^>]+)>/)?.[1] ?? configured.trim();
  const name = (displayName || "SwiftCard").replace(/[<>"\r\n]/g, "").trim() || "SwiftCard";
  return `${name} <${addr}>`;
}

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
    .replace(/[^\x00-\x7F\n]/g, "")             // strip non-ASCII but keep newlines
    .replace(/[^\S\n]+/g, " ")                  // collapse spaces/tabs, keep newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Plain-text SMS with a clean signature (name, company) + the sender's card link.
export function buildSmsBody(opts: { senderName: string; company?: string | null; text: string; cardUrl?: string | null }): string {
  let body = opts.text.trim();
  body += `\n\n— ${opts.senderName}${opts.company ? `, ${opts.company}` : ""}`;
  if (opts.cardUrl) body += `\n${opts.cardUrl}`;
  body += `\nvia SwiftCard ${APP_URL}/join?src=follow_up`;
  body = toGsm7(body);
  if (body.length > 480) body = body.slice(0, 477) + "...";
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
  sender: { name?: string | null; company?: string | null; title?: string | null; phone?: string | null; email?: string | null; website?: string | null };
  text: string;                               // plain body (SMS + thread log + fallback email)
  subject?: string | null;                    // email subject (personal email path)
  email?: { subject: string; html: string };  // custom email template (automations); omit → personal email
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
      : await sendBrandedEmail({ to: lead.email, senderName, company: sender.company, title: sender.title, text: opts.text, subject: opts.subject, replyTo: sender.email || null, phone: sender.phone || null, website: sender.website || null, cardUsername: opts.cardUsername });
    if (doLog && status === "sent") await logMessage({ leadId: opts.leadId, cardOwner: opts.cardOwner, direction: "out", channel: "email", body: opts.text, status });
    return { channel: "email", status };
  }

  if (use === "sms" && lead.phone) {
    if (await isOptedOut("sms", lead.phone)) return { channel: "sms", status: "opted_out" };
    const cardUrl = opts.cardUsername ? `${APP_URL}/card/${opts.cardUsername}` : null;
    const status = await sendSms(lead.phone, buildSmsBody({ senderName, company: sender.company, text: opts.text, cardUrl }));
    if (doLog && status === "sent") await logMessage({ leadId: opts.leadId, cardOwner: opts.cardOwner, direction: "out", channel: "sms", body: opts.text, status });
    return { channel: "sms", status };
  }

  return { channel: "none", status: "no_contact" };
}

// Build the shared HTML signature block (name/company/contacts + card link).
// Used so emails look like a real personal email, not a notification.
// Default signature: the sender's name + business name stacked ON TOP of their
// SwiftCard link. Kept deliberately simple so every email signs off the same way.
export function emailSignatureHtml(opts: { senderName: string; company?: string | null; title?: string | null; phone?: string | null; email?: string | null; website?: string | null; cardUrl?: string | null }): string {
  const lines: string[] = [];
  lines.push(`<p style="margin:0;font-size:14px;font-weight:700;color:#111827;">${esc(opts.senderName)}</p>`);
  if (opts.company) lines.push(`<p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${esc(opts.company)}</p>`);
  if (opts.cardUrl) lines.push(`<a href="${opts.cardUrl}" style="display:inline-block;margin-top:10px;font-size:13px;color:#2563eb;text-decoration:none;font-weight:600;">View my SwiftCard → ${esc(opts.cardUrl.replace(/^https?:\/\//, ""))}</a>`);
  return `<div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;">${lines.join("")}</div>`;
}

// Wrap a plain message body in a clean personal-email shell + signature.
// Blank lines become real paragraph spacing so the email "breathes" like a
// message a person actually typed; single newlines become line breaks.
export function personalEmailHtml(text: string, signature: string): string {
  const paragraphs = esc(text.trim())
    .split(/\n{2,}/)
    .filter((p) => p.length > 0)
    .map((p) => `<p style="margin:0 0 16px;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;font-size:15px;line-height:1.7;max-width:560px;margin:0 auto;padding:24px 16px;">
  <div>${paragraphs}</div>
  ${signature}
  <p style="margin-top:18px;color:#9ca3af;font-size:11px;">Sent with <a href="${APP_URL}/join?src=follow_up" style="color:#9ca3af;text-decoration:underline;">SwiftCard</a> — get 1 month of Pro free.</p>
</div>`;
}

// A proper personal email: subject + message body + signature (name/company + card link).
export async function sendBrandedEmail(opts: {
  to: string;
  senderName: string;
  company?: string | null;
  title?: string | null;
  text: string;
  subject?: string | null;
  replyTo?: string | null;
  phone?: string | null;
  website?: string | null;
  cardUsername?: string | null;
}): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) return "not_configured";
  const resend = new Resend(process.env.RESEND_API_KEY);
  const cardUrl = opts.cardUsername ? `${APP_URL}/card/${opts.cardUsername}` : null;
  const subject = opts.subject?.trim() || `Message from ${opts.senderName}`;
  const signature = emailSignatureHtml({
    senderName: opts.senderName,
    company: opts.company,
    title: opts.title,
    phone: opts.phone,
    email: opts.replyTo,
    website: opts.website,
    cardUrl,
  });

  try {
    await resend.emails.send({
      // Recipient sees the person's name; replies go to the user's own inbox.
      from: senderFrom(opts.senderName),
      to: opts.to,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      subject,
      html: personalEmailHtml(opts.text, signature),
    });
    return "sent";
  } catch {
    return "failed";
  }
}
