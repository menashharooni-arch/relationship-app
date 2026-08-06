import { Resend } from "resend";
import twilio from "twilio";
import { createHmac, timingSafeEqual } from "crypto";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { htmlToText } from "@/lib/email-text";
import { reportError } from "@/lib/report-error";

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
  try {
    // Inside the try on purpose: unsubSecret() throws on a misconfigured
    // deployment, and this function backs the List-Unsubscribe-Post endpoint. A
    // 500 there reads to mailbox providers as a broken opt-out — worse than
    // advertising no header at all. The loud failure stays on the SIGNING side
    // (contactUnsubUrl), where it blocks a send instead of breaking a promise.
    const expected = unsubSig(encoded);
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const email = Buffer.from(encoded, "base64url").toString("utf8");
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

// RFC 8058 one-click unsubscribe headers for any email sent to a LEAD.
// Degrades to NO headers when the signing secret is absent, rather than throwing
// and taking every send down with it: contactUnsubUrl() throws by design on a
// misconfigured deployment, and this helper sits inside sendRawEmail's try, so a
// throw here turned "no unsubscribe secret" into "no email at all". The
// fail-closed guarantee that matters — never sign with a public constant — is
// unchanged. Reported loudly so a missing secret surfaces as an alert instead of
// as mail quietly going out without an opt-out header.
function unsubHeaders(to: string): Record<string, string> {
  try {
    return {
      "List-Unsubscribe": `<${contactUnsubUrl(to)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  } catch (e) {
    void reportError("unsub-headers-unsigned", e, { note: "sent without List-Unsubscribe" });
    return {};
  }
}

export type SendResult = "sent" | "not_configured" | "failed";

// Build the From header: the per-sender display name on the ONE verified address
// (RESEND_FROM_EMAIL), so recipients see the person who messaged them — not a
// generic "SwiftCard" — while every user still sends from the same verified domain.
// `baseFrom` lets a caller pass an already-resolved address (getMarketingFrom(),
// which falls back to Resend's sandbox sender before the domain verifies) without
// losing the display-name personalisation or this sanitizer.
export function senderFrom(displayName: string | null | undefined, baseFrom?: string | null): string {
  const configured = baseFrom || process.env.RESEND_FROM_EMAIL || "SwiftCard <hello@swiftcard.me>";
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
    const { data, error } = await getAdminSupabase()
      .from("message_opt_outs")
      .select("id")
      .eq("channel", channel)
      .eq("contact", normContact(channel, contact))
      .maybeSingle();
    // FAIL CLOSED. This is the suppression gate in front of every send: if we
    // can't confirm someone HASN'T opted out, we must not message them. The old
    // blanket `return false` meant one transient database error silently
    // disabled opt-out enforcement for that whole run and texted/emailed people
    // who had explicitly said stop. The single exception is 42P01 (relation does
    // not exist) — the pre-migration case this catch was written for, where no
    // opt-out can exist yet anyway.
    if (error) return (error as { code?: string }).code !== "42P01";
    return !!data;
  } catch (e) {
    return (e as { code?: string })?.code !== "42P01";
  }
}

/**
 * Bulk form of isOptedOut for a whole recipient list. Returns the set of
 * NORMALIZED addresses that have opted out — callers must normalize before
 * testing membership, or use `isEmailOptedOut` below.
 *
 * Exists because contact-level opt-outs were invisible to the account-holder
 * senders. `message_opt_outs` was consulted only by the lead / invite /
 * follow-up paths, so someone who unsubscribed from a follow-up — and was
 * told SwiftCard would stop emailing that address — kept receiving broadcasts
 * and upgrade pitches whenever the same address was also their account email.
 * Neither unsubscribe endpoint writes the other table, so the two suppression
 * lists never converged on their own.
 *
 * Chunked rather than one query per recipient: the senders deliberately avoid
 * N serial round trips in a single invocation, because that is a timeout risk
 * that can strand a send half-finished.
 *
 * FAIL CLOSED, like isOptedOut: on any error other than "table missing", every
 * address is reported as opted out. If we cannot confirm someone has NOT opted
 * out, we do not mail them.
 */
export async function emailOptOutSet(emails: (string | null | undefined)[]): Promise<Set<string>> {
  const wanted = Array.from(
    new Set(emails.filter(Boolean).map((e) => normContact("email", e as string))),
  );
  if (!wanted.length) return new Set();

  const out = new Set<string>();
  const admin = getAdminSupabase();
  for (let i = 0; i < wanted.length; i += 500) {
    const chunk = wanted.slice(i, i + 500);
    try {
      const { data, error } = await admin
        .from("message_opt_outs")
        .select("contact")
        .eq("channel", "email")
        .in("contact", chunk);
      if (error) {
        if ((error as { code?: string }).code === "42P01") return new Set();
        for (const c of chunk) out.add(c);
        continue;
      }
      for (const r of data ?? []) out.add(r.contact as string);
    } catch (e) {
      if ((e as { code?: string })?.code === "42P01") return new Set();
      for (const c of chunk) out.add(c);
    }
  }
  return out;
}

/** Membership test for a set from emailOptOutSet, applying the same normalization. */
export function isEmailOptedOut(set: Set<string>, email: string | null | undefined): boolean {
  if (!email) return false;
  return set.has(normContact("email", email));
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
  /** Twilio message SID, so the status callback can update this row later. */
  providerSid?: string | null;
}): Promise<void> {
  try {
    await getAdminSupabase().from("lead_messages").insert({
      lead_id: opts.leadId,
      card_owner: opts.cardOwner ?? null,
      direction: opts.direction,
      channel: opts.channel,
      body: opts.body,
      status: opts.status ?? null,
      ...(opts.providerSid ? { provider_sid: opts.providerSid } : {}),
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
// Returns the send status AND Twilio's message SID. The SID matters: Twilio
// ACCEPTS a message synchronously ("sent" here) and then delivery succeeds or
// fails ASYNCHRONOUSLY at the carrier — an unregistered A2P 10DLC number, for
// example, is silently dropped (error 30034) AFTER the API said yes. Callers
// store the SID on the logged message (logMessage providerSid) so the
// /api/twilio/status callback can mark it delivered/undelivered later.
export async function sendSms(to: string, body: string): Promise<{ status: SendResult; sid: string | null }> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID, TWILIO_PHONE_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_PHONE_NUMBER)) {
    return { status: "not_configured", sid: null };
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  // Delivery-status callback: only on a public https origin (Twilio can't reach
  // localhost, and preview deploys must not receive prod callbacks).
  const statusCallback =
    APP_URL.startsWith("https://") && !APP_URL.includes("localhost")
      ? `${APP_URL}/api/twilio/status`
      : undefined;
  try {
    const msg = await client.messages.create({
      to,
      body,
      ...(statusCallback ? { statusCallback } : {}),
      // Prefer the Messaging Service (one shared sender for ALL users, scales
      // long code → short code by config). Falls back to a single number.
      ...(TWILIO_MESSAGING_SERVICE_SID
        ? { messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID }
        : { from: TWILIO_PHONE_NUMBER! }),
    });
    return { status: "sent", sid: msg.sid ?? null };
  } catch (e) {
    // A hard API rejection (bad sender, invalid number, suspended account) was
    // being swallowed to a bare "failed" with zero trace — surface it to ops.
    try {
      const { reportError } = await import("@/lib/report-error");
      await reportError("sms.send", e);
    } catch { /* reporting is best-effort */ }
    return { status: "failed", sid: null };
  }
}

function esc(v: string | null | undefined) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Send pre-built HTML (used by automations that have their own templates).
// fromName personalizes the From display name (the card owner's name on the one
// verified address) so automated emails arrive AS the person, not "SwiftCard".
export async function sendRawEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
  fromName?: string | null;
  /** Pre-resolved From address (e.g. getMarketingFrom()); the display name is still applied. */
  fromAddress?: string | null;
}): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) return "not_configured";
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { error } = await resend.emails.send({
      from: opts.fromName
        ? senderFrom(opts.fromName, opts.fromAddress)
        : (opts.fromAddress || process.env.RESEND_FROM_EMAIL || "SwiftCard <hello@swiftcard.me>"),
      to: opts.to,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      subject: opts.subject,
      html: opts.html,
      // multipart/alternative: a plain-text part is a major deliverability
      // signal (HTML-only mail scores as spam). See email-text.ts.
      text: htmlToText(opts.html),
      // Every email to a lead carries one-click unsubscribe (RFC 8058).
      headers: unsubHeaders(opts.to),
    });
    // The SDK RESOLVES with {data, error} for API-level failures — it does not
    // throw — so ignoring the return value reported "sent" for every rejection
    // (bad key, unverified domain, suppressed address). The reminders route
    // stamps sent_at on `status === "sent"`, so a discarded error here silently
    // burned sequence steps that never went out.
    return error ? "failed" : "sent";
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
    const { status, sid } = await sendSms(lead.phone, buildSmsBody({ senderName, company: sender.company, text: opts.text, cardUrl, paid: opts.senderPaid }));
    // providerSid lets the delivery callback correct this row from "sent" to
    // "undelivered" if the carrier drops it after Twilio accepted it.
    if (doLog && status === "sent") await logMessage({ leadId: opts.leadId, cardOwner: opts.cardOwner, direction: "out", channel: "sms", body: opts.text, status, providerSid: sid });
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

  const html = personalEmailHtml(opts.text, signature, contactUnsubUrl(opts.to), opts.senderPaid);
  try {
    const { error } = await resend.emails.send({
      // Recipient sees the person's name; replies go to the user's own inbox.
      from: senderFrom(opts.senderName),
      to: opts.to,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      subject,
      html,
      // Plain-text alternative (multipart) — deliverability. See email-text.ts.
      text: htmlToText(html),
      headers: unsubHeaders(opts.to),
    });
    // Same trap sendRawEmail documents above: the SDK RESOLVES with {data,
    // error} rather than throwing, so discarding the result reported "sent" for
    // every rejection. This is the branded path, so the silent failures were the
    // ones that matter most — automation steps got stamped as delivered and were
    // never retried, while the lead received nothing.
    return error ? "failed" : "sent";
  } catch {
    return "failed";
  }
}
