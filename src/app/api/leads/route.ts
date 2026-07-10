import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { syncLeadToGoogle } from "@/lib/sync-google";
import { syncLeadToHubSpot } from "@/lib/sync-hubspot";
import { getSourceLabel } from "@/lib/source-labels";
import { sendPushToUser } from "@/lib/push";
import { PLAN_LIMITS, LOCKED_LEAD_TAG, isPaidPlan } from "@/lib/plan";
import { readUsage, bumpUsage } from "@/lib/usage";
import { cardWithinPlanLimit, ownerIsDeleted } from "@/lib/card-active";
import { escapeHtml, safeUrlAttr } from "@/lib/escape";
import { isRateLimited } from "@/lib/rate-limit";
import { isZapierWebhookUrl } from "@/lib/safe-fetch";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, company, message, card_owner, tags, source, visitor_id } = await req.json();

    // This is a PUBLIC endpoint — require real strings, not just truthy values
    // (a JSON payload of {name: [], phone: {}} would otherwise pass and crash
    // downstream string handling in emails/vCards).
    if (typeof name !== "string" || !name.trim() || typeof phone !== "string" || !phone.trim() || typeof card_owner !== "string" || !card_owner.trim()) {
      return NextResponse.json({ error: "Name and phone are required." }, { status: 400 });
    }

    // Visitors must not be able to inject system tags ("sc-locked" would hide
    // the lead behind the paywall, "email-paused" would kill its automations).
    // Only the scanner's benign marker survives from the client.
    const CLIENT_TAG_WHITELIST = new Set(["scanned"]);
    const safeTags = (Array.isArray(tags) ? tags : []).filter(
      (t): t is string => typeof t === "string" && CLIENT_TAG_WHITELIST.has(t)
    );

    // Rate limit: same IP submitting to the same card too frequently.
    // card_owner is normalized so "Alice " vs "alice" can't mint fresh buckets.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateKey = `${ip}:${card_owner.trim().toLowerCase()}`;
    if (await isRateLimited(rateKey)) {
      return NextResponse.json({ error: "Too many submissions. Please wait a few minutes." }, { status: 429 });
    }

    // Extract location from Vercel's built-in geo headers (no API key needed)
    const city = req.headers.get("x-vercel-ip-city");
    const country = req.headers.get("x-vercel-ip-country");
    const location = city && country
      ? `${decodeURIComponent(city)}, ${country}`
      : country || null;

    const admin = getAdminSupabase();

    // Resolve the OWNER of this card slug. card_owner is the card's username —
    // for multi-card accounts that is NOT the profile slug, so look the card up
    // first and fall back to the legacy profile-slug match. Without this,
    // notifications/emails silently skipped every non-primary card.
    const ownerSelect = "id, plan, name, email, phone, company, zapier_webhook_url, customization";
    const { data: cardRow } = await admin.from("cards").select("id, user_id, name, email, phone, company, label").eq("username", card_owner).maybeSingle();
    const { data: ownerProfile } = cardRow?.user_id
      ? await admin.from("profiles").select(ownerSelect).eq("id", cardRow.user_id).maybeSingle()
      : await admin.from("profiles").select(ownerSelect).eq("username", card_owner).maybeSingle();

    // ISOLATION RULE: the account's signup email must never appear on anything
    // card-facing. Everything shown to the LEAD comes from the CARD's own
    // identity (falling back to the profile only for legacy profile-cards).
    const cardIdentity = {
      name: (cardRow?.name as string) || ownerProfile?.name || "",
      email: (cardRow?.email as string) || ownerProfile?.email || "",
      phone: (cardRow?.phone as string) || ownerProfile?.phone || "",
      company: (cardRow?.company as string) || ownerProfile?.company || "",
    };

    // Kill-switch: no lead capture for nonexistent slugs, deleted accounts, or
    // plan-deactivated extra cards — the page 404s, and this API must not be a
    // back door (previously a bogus card_owner could insert orphan leads).
    if (!ownerProfile || ownerIsDeleted(ownerProfile.customization)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (cardRow && !(await cardWithinPlanLimit(cardRow.id, cardRow.user_id, ownerProfile.plan))) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Free plan: 5 new leads/month. We NEVER reject a visitor's info — over the
    // cap the lead is still captured and stored, just flagged locked (blurred in
    // the owner's dashboard until they upgrade; unlocked instantly when they do).
    // The counter lives on the ACCOUNT so deleting/remaking a card can't reset it.
    let locked = false;
    if (!isPaidPlan(ownerProfile?.plan) && ownerProfile?.id) {
      const usedThisMonth = readUsage(ownerProfile.customization).leads;
      locked = usedThisMonth >= PLAN_LIMITS.FREE_LEADS_PER_MONTH;
      await bumpUsage(admin, ownerProfile.id, ownerProfile.customization as Record<string, unknown> | null, "leads");
    }

    const { data: insertedLead, error } = await admin
      .from("leads")
      .insert({
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        message: message || null,
        location: location || null,
        card_owner,
        // New reach-outs arrive unread; over the free monthly cap they're also
        // tagged locked so the dashboard blurs them behind Pro.
        tags: [...safeTags, "unread", ...(locked ? [LOCKED_LEAD_TAG] : [])],
        source: source || null,
        visitor_id: visitor_id || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ── Everything past this point is BEST-EFFORT ──────────────────────────
    // The lead is already saved. A failure in CRM sync / notifications / email
    // must NEVER report failure back to the visitor (they'd see "something went
    // wrong" and re-submit a duplicate, even though we captured them fine).
    try {
    // Sync to Google Contacts + HubSpot (non-blocking)
    if (ownerProfile?.id) {
      const leadData = { name, email: email || null, phone: phone || null, company: company || null };
      syncLeadToGoogle(leadData, ownerProfile.id).catch((e) => console.error("[leads] Google sync error:", e));
      syncLeadToHubSpot(leadData, ownerProfile.id).catch((e) => console.error("[leads] HubSpot sync error:", e));
    }

    // Fire Zapier webhook (non-blocking) — only to a validated Zapier host, so
    // a URL stored before validation existed can't exfiltrate lead PII (SSRF).
    if (ownerProfile?.zapier_webhook_url && isZapierWebhookUrl(ownerProfile.zapier_webhook_url)) {
      fetch(ownerProfile.zapier_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "lead.created", name, email, phone: phone || null, message: message || null, location, card_owner, tags: safeTags.length ? safeTags : null, created_at: new Date().toISOString() }),
      }).catch(() => {});
    }

    // Insert in-app notification for the card owner (non-blocking; falls back
    // gracefully if the card_owner column migration hasn't run yet)
    if (ownerProfile?.id) {
      const sourceLabel = source ? getSourceLabel(source) : null;
      const sourceStr = sourceLabel && source !== "direct_link" ? ` from ${sourceLabel}` : "";
      const { insertNotification } = await import("@/lib/notify");
      // A locked lead (over the free monthly cap) gets a TEASER notification —
      // it must not reveal the contact's name/details, or that would bypass the
      // lock. It's a conversion nudge instead.
      insertNotification({
        user_id: ownerProfile.id,
        card_owner,
        type: "new_lead",
        title: locked ? "🔒 New lead locked" : `New contact: ${name}`,
        body: locked
          ? "You've hit your 5 free leads this month. Upgrade to Pro to unlock this one — and never miss the next."
          : `${name} shared their info with you${sourceStr}.`,
      }).catch(() => {});

      // Push notification — phone buzz + optional vCard save (teaser when locked)
      if (insertedLead?.id) {
        const vcardUrl = `${APP_URL}/api/leads/vcard?id=${insertedLead.id}`;
        sendPushToUser(ownerProfile.id, {
          title: locked ? "🔒 New lead locked" : `New contact: ${name}`,
          body: locked
            ? "Upgrade to Pro to unlock this lead."
            : (phone ? `${phone}${company ? ` · ${company}` : ""}` : (email ?? "Tap to save")),
          url: `${APP_URL}/dashboard`,
          ...(locked ? {} : { vcardUrl }),
          tag: `lead-${insertedLead.id}`,
        }).catch(() => {});
      }
    }

    // This is a PUBLIC endpoint — every visitor-supplied field below is escaped
    // before it touches the notification email's HTML, so a crafted name/message
    // can't inject markup or a phishing link into the owner's trusted inbox.
    const eName = escapeHtml(name);
    const eCompany = escapeHtml(company);
    const eEmail = escapeHtml(email);
    const ePhone = escapeHtml(phone);
    const eMessage = escapeHtml(message);
    const eLocation = escapeHtml(location);
    const emailHref = safeUrlAttr(email ? `mailto:${email}` : "");
    const telHref = safeUrlAttr(phone ? `tel:${phone}` : "");

    // Send email to the card owner about the new lead (non-blocking). ALL cards
    // alert the ONE email the account was created with (the auth email — the
    // inbox the owner actually checks), and the email is tagged with which card
    // the lead came through. Falls back to profiles.email only if the auth
    // lookup fails.
    const authRes = await admin.auth.admin.getUserById(ownerProfile.id).catch(() => null);
    const accountEmail = authRes?.data?.user?.email || ownerProfile.email || null;
    if (accountEmail) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const locStr = eLocation ? ` · ${eLocation}` : "";
      const ownerFirst = escapeHtml((ownerProfile.name || cardIdentity.name || "there").split(" ")[0]);
      const dashboardUrl = `${APP_URL}/dashboard?card=${encodeURIComponent(card_owner)}`;
      // Which card this lead came through — label first, then the card's name,
      // then the slug (legacy profile-cards fall back to the profile name).
      const cardTag = escapeHtml(
        (cardRow?.label as string) || (cardRow?.name as string) || (cardRow ? card_owner : (ownerProfile.name as string) || card_owner)
      );
      // A locked lead (over the free monthly cap) gets the same TEASER the
      // in-app notification gets — revealing the details in the email would
      // bypass the lock entirely.
      const detailsCard = locked
        ? `<p style="margin:0;font-size:14px;font-weight:700;color:#f1f5f9;">🔒 This lead is locked</p>
      <p style="margin:8px 0 0;font-size:13px;color:#94a3b8;">You've hit your 5 free leads this month. Upgrade to Pro to unlock it — and never miss the next one.</p>`
        : `<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#f1f5f9;">${eName}</p>
      ${eCompany ? `<p style="margin:0 0 6px;font-size:13px;color:#94a3b8;">${eCompany}</p>` : ""}
      ${eEmail ? `<a href="${emailHref}" style="display:block;font-size:13px;color:#60a5fa;margin:0 0 4px;text-decoration:none;">${eEmail}</a>` : ""}
      ${ePhone ? `<a href="${telHref}" style="display:block;font-size:13px;color:#60a5fa;text-decoration:none;">${ePhone}</a>` : ""}
      ${locStr ? `<p style="margin:8px 0 0;font-size:12px;color:#4b5563;">📍${locStr}</p>` : ""}
      ${eMessage ? `<p style="margin:10px 0 0;font-size:13px;color:#94a3b8;font-style:italic;border-top:1px solid #334155;padding-top:10px;">"${eMessage}"</p>` : ""}`;
      resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "SwiftCard <onboarding@resend.dev>",
        to: accountEmail,
        subject: locked ? `New lead on your SwiftCard (locked) · ${(cardRow?.label as string) || (cardRow?.name as string) || card_owner}` : `New lead: ${name} · ${(cardRow?.label as string) || (cardRow?.name as string) || card_owner}`,
        html: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:40px 16px;">
<tr><td align="center"><table width="100%" style="max-width:520px;">
<tr><td style="padding-bottom:28px;">
  <span style="font-size:11px;font-weight:800;letter-spacing:0.2em;color:#94a3b8;text-transform:uppercase;">SwiftCard</span>
</td></tr>
<tr><td>
  <div style="background:#0f172a;border-radius:16px;padding:28px 28px 8px;margin-bottom:20px;">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.15em;color:#4b5563;text-transform:uppercase;">New Contact</p>
    <span style="display:inline-block;background:#1d4ed81f;border:1px solid #1d4ed855;color:#93c5fd;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;margin:0 0 10px;">💳 ${cardTag}</span>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#ffffff;line-height:1.2;">Hey ${ownerFirst}, you have a new lead</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Someone just shared their info with you on your <strong style="color:#9ca3af;">${cardTag}</strong> card.</p>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      ${detailsCard}
    </div>
    <a href="${locked ? `${APP_URL}/pricing` : dashboardUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:99px;font-size:14px;font-weight:700;margin-bottom:28px;">${locked ? "Upgrade to Pro →" : "Open Dashboard →"}</a>
  </div>
  <p style="color:#94a3b8;font-size:11px;text-align:center;margin:0;">SwiftCard · You're receiving this because someone connected with you.</p>
</td></tr>
</table></td></tr>
</table>
</body></html>`,
      }).catch(() => {});
    }

    // NOTE: the instant "Great connecting with you" confirmation email to the
    // LEAD was removed on purpose — the owner's real follow-up (manual or the
    // Day-1 automation) is the first thing the lead hears, not a canned blast.
    } catch (sideErr) {
      // Lead was saved; log and still report success to the visitor.
      console.error("Lead post-insert side-effect error (lead saved):", sideErr instanceof Error ? sideErr.message : sideErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("API route error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
