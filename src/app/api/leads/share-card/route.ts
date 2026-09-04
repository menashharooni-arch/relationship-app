import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { isPaidPlan } from "@/lib/plan";
import { isRateLimited } from "@/lib/rate-limit";
import { resolveCardMeta } from "@/lib/resolve-card";
import { shareImageUrl, warmSharePreviewServer } from "@/lib/share-preview";
import {
  sendSms,
  sendRawEmail,
  isOptedOut,
  logMessage,
  toGsm7,
  contactUnsubUrl,
  emailDocument,
  signatureImageUrl,
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

// Quotes too: these values land inside alt="…" attributes, and a card name
// containing a double quote would otherwise close the attribute early and
// mangle the <img> tag.
function esc(v: string | null | undefined): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Real Twilio / Resend spend per call on the shared sender, previously
  // uncapped — same gap as the lead-message route.
  if (await isRateLimited(`share-card:${user.id}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "You're sharing very quickly — give it a minute and try again." },
      { status: 429 },
    );
  }

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
    admin.from("cards").select("name, title, company, email, phone").eq("username", lead.card_owner as string).maybeSingle(),
    admin.from("profiles").select("name, company, email, plan, customization").eq("id", user.id).maybeSingle(),
  ]);
  // A deleted account sends nothing (same choke point as the automations).
  if ((profile?.customization as { _deleted?: boolean } | null)?._deleted) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ownerName = (card?.name as string) || (profile?.name as string) || "A SwiftCard user";
  const ownerCompany = (card?.company as string) || (profile?.company as string) || null;
  const ownerTitle = (card?.title as string) || null;
  const ownerPhone = (card?.phone as string) || null;
  const replyTo = (card?.email as string) || (profile?.email as string) || null;
  // Pro/Office is sold as "no SwiftCard branding" — drop the attribution lines
  // for paid senders (the STOP notice and the unsubscribe link always stay:
  // those are compliance, not branding).
  const paid = isPaidPlan(profile?.plan as string | null);

  // "Hi john@acme.com," is worse than "Hi," — a contact saved from an address
  // (or a company row) greets by nothing rather than by a string of noise.
  const firstWord = ((lead.name as string) || "").trim().split(/\s+/)[0] ?? "";
  const contactFirst = /^[\p{L}'’-]{2,}$/u.test(firstWord) ? firstWord : "";
  const cardUrl = `${APP_URL}/${lead.card_owner}?shared=1`;

  // Heat the link preview BEFORE the message leaves, so the recipient's
  // messenger finds the card image already rendered instead of racing a cold
  // function and falling back to the headshot (lib/share-preview.ts).
  try {
    const meta = await resolveCardMeta(lead.card_owner as string);
    if (meta) await warmSharePreviewServer(shareImageUrl(APP_URL, lead.card_owner as string, meta));
  } catch { /* best effort */ }

  const results: { sms?: SendResult | "opted_out"; email?: SendResult | "opted_out" } = {};

  // ── Text ──────────────────────────────────────────────────────────────────
  if (wantsSms) {
    if (await isOptedOut("sms", lead.phone as string)) {
      results.sms = "opted_out";
    } else {
      const body = toGsm7(
        `${contactFirst ? `Hi ${contactFirst}! ` : ""}${ownerName} here - save my contact information in the link below.\n` +
        `${cardUrl}\n` +
        `${paid ? "" : "via SwiftCard · "}Reply STOP to opt out`,
      );
      const smsResult = await sendSms(lead.phone as string, body);
      results.sms = smsResult.status;
      if (smsResult.status === "sent") {
        await logMessage({
          leadId: lead.id as string,
          cardOwner: lead.card_owner as string,
          direction: "out",
          channel: "sms",
          body: "Save my contact information in the link below. (shared card link)",
          status: "sent",
          // Twilio only ACCEPTED it here; the delivery callback updates this row
          // if the carrier later drops it (e.g. unregistered A2P 10DLC).
          providerSid: smsResult.sid,
        });
      }
    }
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  if (wantsEmail) {
    if (await isOptedOut("email", lead.email as string)) {
      results.email = "opted_out";
    } else {
      // The signature right under the message: a real picture of the card,
      // always. One URL that resolves at fetch time to the owner's stored
      // Swift Signature, or to the live card render when they have none —
      // so this never degrades to a name-only box, and never rots into a
      // broken image after the owner edits their card (see messaging.ts).
      const sigUrl = signatureImageUrl(lead.card_owner as string);
      const altName = `${esc(ownerName)}${ownerCompany ? `, ${esc(ownerCompany)}` : ""}${paid ? "" : " — SwiftCard"}`;
      const preview = `<a href="${cardUrl}" style="text-decoration:none;"><img src="${sigUrl}" alt="${altName}" width="360" style="display:block;width:100%;max-width:360px;height:auto;border:0;border-radius:14px;" /></a>
  <p style="margin:12px 0 0;font-size:13px;"><a href="${cardUrl}" style="color:#2563eb;font-weight:600;text-decoration:none;">View &amp; save my card →</a></p>`;

      // Deliverability (2026-09-03, the spam-folder report): this mail used to
      // be two short lines, a 360px image and an "Unsubscribe" link — the
      // silhouette of a promo blast, and a spam filter scoring an image-heavy
      // body with almost no text does not care that a human pressed Share.
      // The image stays (it IS the card); what changes is the text around it:
      //   • the sender's details as real, selectable text under the image, so
      //     the message reads as a person's signature — and still says who
      //     they are with images blocked;
      //   • a plain "why you are receiving this" line, which is what Google's
      //     own guidance asks of mail sent on someone's behalf.
      const sigLines = [
        `<p style="margin:0;font-size:14px;font-weight:700;color:#111827;">${esc(ownerName)}</p>`,
        ownerTitle || ownerCompany
          ? `<p style="margin:2px 0 0;font-size:13px;color:#4b5563;">${[ownerTitle, ownerCompany].filter(Boolean).map((v) => esc(v)).join(" · ")}</p>`
          : "",
        ownerPhone ? `<p style="margin:2px 0 0;font-size:13px;color:#4b5563;">${esc(ownerPhone)}</p>` : "",
        replyTo ? `<p style="margin:2px 0 0;font-size:13px;color:#4b5563;">${esc(replyTo)}</p>` : "",
      ].filter(Boolean).join("");

      // A real HTML document, not a bare <div>: this body carries "→" and "·",
      // and a client that is not told the encoding renders those as "â†'" and
      // "Â·". The preheader is what Gmail shows next to the subject.
      const html = emailDocument(`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;background-color:#ffffff;font-size:15px;line-height:1.7;max-width:560px;margin:0 auto;padding:24px 16px;">
  <p style="margin:0 0 16px;">${contactFirst ? `Hi ${esc(contactFirst)},` : "Hi,"}</p>
  <p style="margin:0 0 16px;">Save my contact information in the link below. It opens my digital business card, and you can add me to your phone with one tap.</p>
  <p style="margin:0 0 20px;"><a href="${cardUrl}" style="color:#2563eb;font-weight:600;">${esc(cardUrl.replace(/^https?:\/\//, ""))}</a></p>
  ${preview}
  <div style="margin-top:20px;padding-top:14px;border-top:1px solid #e5e7eb;">${sigLines}</div>
  <p style="margin-top:24px;color:#9ca3af;font-size:11px;">You're receiving this because ${esc(ownerName)} shared their contact card with you.${paid ? "" : ` Sent with <a href="${APP_URL}/join?src=share_contact" style="color:#9ca3af;text-decoration:underline;">SwiftCard</a>.`} <a href="${contactUnsubUrl(lead.email as string)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a></p>
</div>`, [ownerName, ownerTitle, ownerCompany].filter(Boolean).join(" · "));

      results.email = await sendRawEmail({
        to: lead.email as string,
        // Descriptive, not an imperative CTA. "Save X's contact information"
        // is the voice of a marketing blast; this is one person handing another
        // their details, and the subject should read that way in the list.
        subject: `Contact information from ${ownerName}`,
        html,
        // One person handing another their details: connect@, with the reply
        // going to the card owner. It must never come back to us.
        sender: "connect",
        replyTo,
        fromName: ownerName,
        // The user tapped Share on one contact — this is personal mail, not a
        // list send, and must not carry List-Unsubscribe headers.
        personal: true,
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
