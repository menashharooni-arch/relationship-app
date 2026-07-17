import { Resend } from "resend";
import twilio from "twilio";
import { createHmac, timingSafeEqual } from "crypto";
import { getAdminSupabase } from "@/lib/supabase-admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// ── Contact-level unsubscribe (for emails we send TO leads) ─────────────────
// Signed token = base64url(email) + "." + HMAC — so only links we generated can
// opt an address out (nobody can suppress someone else's follow-ups by guessing).
// Fail closed: with no server secret at all, tokens signed by a public
// constant would let anyone forge unsubscribes for arbitrary addresses.
// Both env vars are set in every deployed environment; throwing here only
// surfaces a misconfigured deployment instead of silently weakening the HMAC.
// Read lazily (not at module load) so env can be provided after import — same
// pattern as oauth-state.ts/token-crypto.ts.
function unsubSecret(): string {
  const s = process.env.OAUTH_SECRET || process.env.CRON_SECRET || "";
  if (!s) throw new Error("OAUTH_SECRET/CRON_SECRET missing — refusing to sign unsubscribe tokens");
  return s;
}

function unsubSig(encoded: string): string {
  return createHmac("sha256", unsubSecret()).update(`unsub:${encoded}`).digest("base64url").slice(0, 24);
}

export function contactUnsubUrl(email: string): string {
  const encoded = Buffer.from(email.trim().toLowerCase()).toString("base64url");
  return `${APP_URL}/api/unsubscribe/contact?token=${encoded}.${unsubSig(encoded)}`;
}

export function verifyContactUnsubToken(token: string): string | null {
  const [encoded, sig] = (token || "").split(".");
  if (!encoded || !sig) return null;
  const expected = unsubSig(encoded);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const email = Buffer.from(encoded, "base64url").toString("utf8");
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

// RFC 8058 one-click unsubscribe headers for any email sent to a LEAD.
function unsubHeaders(to: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${contactUnsubUrl(to)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

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
// `paid` suppresses the "via SwiftCard" attribution line: Pro is sold as "no
// SwiftCard branding / 100% your brand", and this text goes out under the
// sender's own name to THEIR contact.
export function buildSmsBody(opts: { senderName: string; company?: string | null; text: string; cardUrl?: string | null; paid?: boolean }): string {
  let body = opts.text.trim();
  body += `\n\n— ${opts.senderName}${opts.company ? `, ${opts.company}` : ""}`;
  if (opts.cardUrl) body += `\n${opts.cardUrl}`;
  if (!opts.paid) body += `\nvia SwiftCard ${APP_URL}/join?src=follow_up`;
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
// fromName personalizes the From display name (the card owner's name on the one
// verified address) so automated emails arrive AS the person, not "SwiftCard".
export async function sendRawEmail(opts: { to: string; subject: string; html: string; replyTo?: string | null; fromName?: string | null }): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) return "not_configured";
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({
      from: opts.fromName ? senderFrom(opts.fromName) : (process.env.RESEND_FROM_EMAIL || "SwiftCard <onboarding@resend.dev>"),
      to: opts.to,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      subject: opts.subject,
      html: opts.html,
      // Every email to a lead carries one-click unsubscribe (RFC 8058).
      headers: unsubHeaders(opts.to),
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
  /** Sender is on Pro/Office → strip SwiftCard branding from the message. */
  senderPaid?: boolean;
}): Promise<DeliverResult> {
  const { lead, sender } = opts;
  const senderName = sender.name || "A SwiftCard user";
  const doLog = opts.log !== false;

  // An explicit channel choice is STRICT: a text step never leaks out as an
  // email (or vice versa) — that caused duplicate same-day sends when a lead
  // was missing one contact method. Without an explicit channel, email-first.
  let use: "email" | "sms" | "none" = "none";
  if (opts.channel === "email") use = lead.email ? "email" : "none";
  else if (opts.channel === "sms") use = lead.phone ? "sms" : "none";
  else if (lead.email) use = "email";
  else if (lead.phone) use = "sms";

  if (use === "email" && lead.email) {
    if (await isOptedOut("email", lead.email)) return { channel: "email", status: "opted_out" };
    const status = opts.email
      ? await sendRawEmail({ to: lead.email, subject: opts.email.subject, html: opts.email.html, replyTo: sender.email || null, fromName: sender.name || null })
      : await sendBrandedEmail({ to: lead.email, senderName, company: sender.company, title: sender.title, text: opts.text, subject: opts.subject, replyTo: sender.email || null, phone: sender.phone || null, website: sender.website || null, cardUsername: opts.cardUsername, senderPaid: opts.senderPaid });
    if (doLog && status === "sent") await logMessage({ leadId: opts.leadId, cardOwner: opts.cardOwner, direction: "out", channel: "email", body: opts.text, status });
    return { channel: "email", status };
  }

  if (use === "sms" && lead.phone) {
    if (await isOptedOut("sms", lead.phone)) return { channel: "sms", status: "opted_out" };
    const cardUrl = opts.cardUsername ? `${APP_URL}/card/${opts.cardUsername}` : null;
    const status = await sendSms(lead.phone, buildSmsBody({ senderName, company: sender.company, text: opts.text, cardUrl, paid: opts.senderPaid }));
    if (doLog && status === "sent") await logMessage({ leadId: opts.leadId, cardOwner: opts.cardOwner, direction: "out", channel: "sms", body: opts.text, status });
    return { channel: "sms", status };
  }

  return { channel: "none", status: "no_contact" };
}

// The public URL of the sender's stored Swift Signature image (the exact card
// image they copy from the dashboard), or null if they haven't generated one.
// HEAD-checked so we never embed a broken image.
export async function resolveSignatureImageUrl(username: string | null | undefined): Promise<string | null> {
  if (!username) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const url = `${base}/storage/v1/object/public/card-signatures/${encodeURIComponent(username)}.png`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(t);
    return res.ok ? `${url}?v=${Date.now()}` : null; // cache-bust so an updated card refreshes
  } catch { return null; }
}

// Build the shared HTML signature block. When the sender has a Swift Signature
// image (the exact card they'd paste into an email themselves), the automation
// signs off with THAT image — identical to the SwiftCard we offer them — linked
// to their card. Falls back to the simple name/company/link block for anyone who
// hasn't generated their signature image yet (or image-blocked clients via alt).
export function emailSignatureHtml(opts: { senderName: string; company?: string | null; title?: string | null; phone?: string | null; email?: string | null; website?: string | null; cardUrl?: string | null; signatureImageUrl?: string | null }): string {
  if (opts.signatureImageUrl) {
    const alt = `${esc(opts.senderName)}${opts.company ? `, ${esc(opts.company)}` : ""} — SwiftCard`;
    const img = `<img src="${opts.signatureImageUrl}" alt="${alt}" width="360" style="display:block;width:100%;max-width:360px;height:auto;border:0;border-radius:12px;" />`;
    const wrapped = opts.cardUrl ? `<a href="${opts.cardUrl}" style="text-decoration:none;">${img}</a>` : img;
    return `<div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;">${wrapped}</div>`;
  }
  const lines: string[] = [];
  lines.push(`<p style="margin:0;font-size:14px;font-weight:700;color:#111827;">${esc(opts.senderName)}</p>`);
  if (opts.company) lines.push(`<p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${esc(opts.company)}</p>`);
  if (opts.cardUrl) lines.push(`<a href="${opts.cardUrl}" style="display:inline-block;margin-top:10px;font-size:13px;color:#2563eb;text-decoration:none;font-weight:600;">View my SwiftCard → ${esc(opts.cardUrl.replace(/^https?:\/\//, ""))}</a>`);
  return `<div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;">${lines.join("")}</div>`;
}

// Wrap a plain message body in a clean personal-email shell + signature.
// Blank lines become real paragraph spacing so the email "breathes" like a
// message a person actually typed; single newlines become line breaks.
// `paid` drops the "Sent with SwiftCard — make your own, free to start."
// promo line (Pro = no SwiftCard branding). The Unsubscribe link is NEVER
// dropped — it's a compliance requirement, not branding — so a paid sender's
// footer keeps the unsubscribe on its own.
export function personalEmailHtml(text: string, signature: string, unsubscribeUrl?: string | null, paid?: boolean): string {
  const paragraphs = esc(text.trim())
    .split(/\n{2,}/)
    .filter((p) => p.length > 0)
    .map((p) => `<p style="margin:0 0 16px;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  const promo = `Sent with <a href="${APP_URL}/join?src=follow_up" style="color:#9ca3af;text-decoration:underline;">SwiftCard</a> — make your own, free to start.`;
  const unsub = unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>` : "";
  const footer = paid ? unsub : [promo, unsub].filter(Boolean).join(" · ");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;font-size:15px;line-height:1.7;max-width:560px;margin:0 auto;padding:24px 16px;">
  <div>${paragraphs}</div>
  ${signature}
  ${footer ? `<p style="margin-top:18px;color:#9ca3af;font-size:11px;">${footer}</p>` : ""}
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
  /** Paid sender → no SwiftCard promo line in the footer. */
  senderPaid?: boolean;
}): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) return "not_configured";
  const resend = new Resend(process.env.RESEND_API_KEY);
  const cardUrl = opts.cardUsername ? `${APP_URL}/card/${opts.cardUsername}` : null;
  const subject = opts.subject?.trim() || `Message from ${opts.senderName}`;
  // Sign off with the sender's actual Swift Signature card image when available.
  const signatureImageUrl = await resolveSignatureImageUrl(opts.cardUsername);
  const signature = emailSignatureHtml({
    senderName: opts.senderName,
    company: opts.company,
    title: opts.title,
    phone: opts.phone,
    email: opts.replyTo,
    website: opts.website,
    cardUrl,
    signatureImageUrl,
  });

  try {
    await resend.emails.send({
      // Recipient sees the person's name; replies go to the user's own inbox.
      from: senderFrom(opts.senderName),
      to: opts.to,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      subject,
      html: personalEmailHtml(opts.text, signature, contactUnsubUrl(opts.to), opts.senderPaid),
      headers: unsubHeaders(opts.to),
    });
    return "sent";
  } catch {
    return "failed";
  }
}
