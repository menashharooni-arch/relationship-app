import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import {
  sendSms,
  sendRawEmail,
  isOptedOut,
  logMessage,
  toGsm7,
  contactUnsubUrl,
  resolveSignatureImageUrl,
  type SendResult,
} from "@/lib/messaging";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Share YOUR contact info with a saved contact — a one-time text and/or email
// through the same senders the automations use (the shared Twilio number, the
// verified Resend address with the owner's display name). POST
// { leadId, channel: "sms" | "email" | "both" } (channel defaults to sms for
// the older dashboard quick-button).
//
// The link carries ?shared=1: the owner pressed Share on a contact they already
// HAVE, so the card page tells the recipient their info has already been shared
// instead of asking them to fill the share-back form.

function esc(v: string | null | undefined): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId, channel: rawChannel } = (await req.json().catch(() => ({}))) as {
    leadId?: string;
    channel?: string;
  };
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
  const channel = rawChannel === "email" || rawChannel === "both" ? rawChannel : "sms";

  const admin = getAdminSupabase();
  const { data: lead } = await admin
    .from("leads")
    .select("id, name, phone, email, card_owner")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  // The contact must belong to one of THIS user's cards.
  const owned = await getOwnerUsernames(user.id);
  if (!owned.includes(lead.card_owner as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const wantsSms = channel === "sms" || channel === "both";
  const wantsEmail = channel === "email" || channel === "both";
  if (wantsSms && !lead.phone) {
    return NextResponse.json({ error: "This contact has no phone number." }, { status: 400 });
  }
  if (wantsEmail && !lead.email) {
    return NextResponse.json({ error: "This contact has no email address." }, { status: 400 });
  }

  // Sender identity mirrors the automations: the CARD the contact belongs to
  // (name/company/email per card), profile as fallback.
  const [{ data: card }, { data: profile }] = await Promise.all([
    admin.from("cards").select("name, company, email").eq("username", lead.card_owner as string).maybeSingle(),
    admin.from("profiles").select("name, company, email, customization").eq("id", user.id).maybeSingle(),
  ]);
  // A deleted account sends nothing (same choke point as the automations).
  if ((profile?.customization as { _deleted?: boolean } | null)?._deleted) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ownerName = (card?.name as string) || (profile?.name as string) || "A SwiftCard user";
  const ownerCompany = (card?.company as string) || (profile?.company as string) || null;
  const replyTo = (card?.email as string) || (profile?.email as string) || null;

  const contactFirst = ((lead.name as string) || "").split(" ")[0];
  const cardUrl = `${APP_URL}/card/${lead.card_owner}?shared=1`;

  const results: { sms?: SendResult | "opted_out"; email?: SendResult | "opted_out" } = {};

  // ── Text ──────────────────────────────────────────────────────────────────
  if (wantsSms) {
    if (await isOptedOut("sms", lead.phone as string)) {
      results.sms = "opted_out";
    } else {
      const body = toGsm7(
        `${contactFirst ? `Hi ${contactFirst}! ` : ""}${ownerName} here - save my contact information in the link below.\n` +
        `${cardUrl}\n` +
        `via SwiftCard · Reply STOP to opt out`,
      );
      results.sms = await sendSms(lead.phone as string, body);
      if (results.sms === "sent") {
        await logMessage({
          leadId: lead.id as string,
          cardOwner: lead.card_owner as string,
          direction: "out",
          channel: "sms",
          body: "Save my contact information in the link below. (shared card link)",
        });
      }
    }
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  if (wantsEmail) {
    if (await isOptedOut("email", lead.email as string)) {
      results.email = "opted_out";
    } else {
      // The preview right under the message: the owner's Swift Signature card
      // image when they have one (the exact card, linked), otherwise a clean
      // card-style block with their name/company.
      const signatureImageUrl = await resolveSignatureImageUrl(lead.card_owner as string);
      const preview = signatureImageUrl
        ? `<a href="${cardUrl}" style="text-decoration:none;"><img src="${signatureImageUrl}" alt="${esc(ownerName)}${ownerCompany ? `, ${esc(ownerCompany)}` : ""} — SwiftCard" width="360" style="display:block;width:100%;max-width:360px;height:auto;border:0;border-radius:14px;" /></a>`
        : `<a href="${cardUrl}" style="display:block;text-decoration:none;border:1px solid #e5e7eb;border-radius:14px;padding:18px 20px;background:#f9fafb;">
             <span style="display:block;font-size:16px;font-weight:700;color:#0f172a;">${esc(ownerName)}</span>
             ${ownerCompany ? `<span style="display:block;font-size:13px;color:#6b7280;margin-top:2px;">${esc(ownerCompany)}</span>` : ""}
             <span style="display:inline-block;margin-top:10px;font-size:13px;font-weight:600;color:#2563eb;">View &amp; save my card →</span>
           </a>`;

      const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;font-size:15px;line-height:1.7;max-width:560px;margin:0 auto;padding:24px 16px;">
  <p style="margin:0 0 16px;">${contactFirst ? `Hi ${esc(contactFirst)},` : "Hi,"}</p>
  <p style="margin:0 0 16px;">Save my contact information in the link below.</p>
  <p style="margin:0 0 20px;"><a href="${cardUrl}" style="color:#2563eb;font-weight:600;">${esc(cardUrl.replace(/^https?:\/\//, ""))}</a></p>
  ${preview}
  <p style="margin-top:24px;color:#9ca3af;font-size:11px;">Sent with <a href="${APP_URL}/join?src=share_contact" style="color:#9ca3af;text-decoration:underline;">SwiftCard</a> · <a href="${contactUnsubUrl(lead.email as string)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a></p>
</div>`;

      results.email = await sendRawEmail({
        to: lead.email as string,
        subject: `Save ${ownerName}'s contact information`,
        html,
        replyTo,
        fromName: ownerName,
      });
      if (results.email === "sent") {
        await logMessage({
          leadId: lead.id as string,
          cardOwner: lead.card_owner as string,
          direction: "out",
          channel: "email",
          body: "Save my contact information in the link below. (shared card link)",
        });
      }
    }
  }

  // ── Shape the response ────────────────────────────────────────────────────
  const attempted = Object.entries(results) as [string, SendResult | "opted_out"][];
  const sent = attempted.filter(([, s]) => s === "sent").map(([c]) => c);
  const failed = attempted.filter(([, s]) => s !== "sent");

  if (sent.length === 0) {
    const [, firstStatus] = failed[0] ?? [null, "failed"];
    if (firstStatus === "opted_out") {
      return NextResponse.json({ error: "This contact opted out of messages." }, { status: 409 });
    }
    if (firstStatus === "not_configured") {
      return NextResponse.json({ error: "Sending isn't set up yet. Contact support." }, { status: 503 });
    }
    return NextResponse.json({ error: "Couldn't send. Please try again." }, { status: 502 });
  }

  // Partial success on "both" still reports what went out.
  return NextResponse.json({ ok: true, sent, ...results });
}
