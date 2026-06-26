import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { syncLeadToGoogle } from "@/lib/sync-google";
import { syncLeadToHubSpot } from "@/lib/sync-hubspot";
import { getSourceLabel } from "@/lib/source-labels";
import { sendPushToUser } from "@/lib/push";
import { PLAN_LIMITS, isPaidPlan } from "@/lib/plan";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

const FREE_LEAD_LIMIT = PLAN_LIMITS.FREE_CONTACT_LIMIT;

// Simple in-process rate limiter: max 3 submissions per 10 min per IP+owner pair
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 3;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_MAX) return true;
  entry.count++;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, company, message, card_owner, tags, source, visitor_id } = await req.json();

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone are required." }, { status: 400 });
    }

    // Rate limit: same IP submitting to the same card too frequently
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateKey = `${ip}:${card_owner}`;
    if (isRateLimited(rateKey)) {
      return NextResponse.json({ error: "Too many submissions. Please wait a few minutes." }, { status: 429 });
    }

    // Extract location from Vercel's built-in geo headers (no API key needed)
    const city = req.headers.get("x-vercel-ip-city");
    const country = req.headers.get("x-vercel-ip-country");
    const location = city && country
      ? `${decodeURIComponent(city)}, ${country}`
      : country || null;

    const admin = getAdminSupabase();

    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("id, plan, name, email, phone, company, zapier_webhook_url")
      .eq("username", card_owner)
      .single();

    if (!isPaidPlan(ownerProfile?.plan)) {
      const { count } = await admin
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("card_owner", card_owner);

      // Cap blocks only NEW captures — existing contacts are untouched.
      if ((count ?? 0) >= FREE_LEAD_LIMIT) {
        return NextResponse.json(
          { error: "limit", message: "This card has reached its free plan limit." },
          { status: 402 }
        );
      }
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
        // New reach-outs arrive unread so the owner can track what they've seen.
        tags: [...(Array.isArray(tags) ? tags : []), "unread"],
        source: source || null,
        visitor_id: visitor_id || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync to Google Contacts + HubSpot (non-blocking)
    if (ownerProfile?.id) {
      const leadData = { name, email: email || null, phone: phone || null, company: company || null };
      syncLeadToGoogle(leadData, ownerProfile.id).catch(() => {});
      syncLeadToHubSpot(leadData, ownerProfile.id).catch(() => {});
    }

    // Fire Zapier webhook (non-blocking)
    if (ownerProfile?.zapier_webhook_url) {
      fetch(ownerProfile.zapier_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phone || null, message: message || null, location, card_owner, tags: tags ?? null, created_at: new Date().toISOString() }),
      }).catch(() => {});
    }

    // Insert in-app notification for the card owner (non-blocking)
    if (ownerProfile?.id) {
      const sourceLabel = source ? getSourceLabel(source) : null;
      const sourceStr = sourceLabel && source !== "direct_link" ? ` from ${sourceLabel}` : "";
      admin.from("notifications").insert({
        user_id: ownerProfile.id,
        card_owner,
        type: "new_lead",
        title: `New contact: ${name}`,
        body: `${name} shared their info with you${sourceStr}.`,
      }).then(() => {});

      // Push notification — phone buzz + optional vCard save
      if (insertedLead?.id) {
        const vcardUrl = `${APP_URL}/api/leads/vcard?id=${insertedLead.id}`;
        sendPushToUser(ownerProfile.id, {
          title: `New contact: ${name}`,
          body: phone ? `${phone}${company ? ` · ${company}` : ""}` : (email ?? "Tap to save"),
          url: `${APP_URL}/dashboard`,
          vcardUrl,
          tag: `lead-${insertedLead.id}`,
        }).catch(() => {});
      }
    }

    // Send email to card owner about the new lead (non-blocking)
    if (ownerProfile?.name && ownerProfile?.email) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const locStr = location ? ` · ${location}` : "";
      const ownerFirst = ownerProfile.name.split(" ")[0];
      resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "SwiftCard <onboarding@resend.dev>",
        to: ownerProfile.email,
        subject: `New lead: ${name} just connected with you`,
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
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#ffffff;line-height:1.2;">Hey ${ownerFirst}, you have a new lead</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Someone just shared their info with you via your SwiftCard.</p>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#f1f5f9;">${name}</p>
      ${company ? `<p style="margin:0 0 6px;font-size:13px;color:#94a3b8;">${company}</p>` : ""}
      ${email ? `<a href="mailto:${email}" style="display:block;font-size:13px;color:#60a5fa;margin:0 0 4px;text-decoration:none;">${email}</a>` : ""}
      ${phone ? `<a href="tel:${phone}" style="display:block;font-size:13px;color:#60a5fa;text-decoration:none;">${phone}</a>` : ""}
      ${locStr ? `<p style="margin:8px 0 0;font-size:12px;color:#4b5563;">📍${locStr}</p>` : ""}
      ${message ? `<p style="margin:10px 0 0;font-size:13px;color:#94a3b8;font-style:italic;border-top:1px solid #334155;padding-top:10px;">"${message}"</p>` : ""}
    </div>
    <a href="${APP_URL}/dashboard" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:99px;font-size:14px;font-weight:700;margin-bottom:28px;">Open Dashboard →</a>
  </div>
  <p style="color:#94a3b8;font-size:11px;text-align:center;margin:0;">SwiftCard · You're receiving this because someone connected with you.</p>
</td></tr>
</table></td></tr>
</table>
</body></html>`,
      }).catch(() => {});
    }

    // Send instant confirmation email to the lead (only when they provided an email)
    if (email && ownerProfile?.name && ownerProfile?.email) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const ownerFirst = ownerProfile.name.split(" ")[0];
      const leadFirst = name.split(" ")[0];

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "SwiftCard <onboarding@resend.dev>",
        replyTo: ownerProfile.email,
        to: email,
        subject: `Great connecting with you, ${leadFirst}! — ${ownerFirst}`,
        html: `
          <div style="background:#ffffff;padding:48px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:480px;margin:0 auto;">
              <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 16px;">
                Hey ${leadFirst}! 👋
              </h2>
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
                It was so great meeting you. I just wanted to make sure you have my contact info saved — feel free to reach out anytime.
              </p>

              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-weight:700;color:#111827;font-size:15px;">${ownerProfile.name}</p>
                ${ownerProfile.company ? `<p style="margin:0 0 8px;color:#6b7280;font-size:13px;">${ownerProfile.company}</p>` : ""}
                <a href="mailto:${ownerProfile.email}" style="display:block;color:#2563eb;font-size:13px;margin:0 0 4px;">${ownerProfile.email}</a>
                ${ownerProfile.phone ? `<a href="tel:${ownerProfile.phone}" style="display:block;color:#2563eb;font-size:13px;">${ownerProfile.phone}</a>` : ""}
              </div>

              <p style="color:#6b7280;font-size:13px;margin:0;">
                Looking forward to keeping in touch!<br/>
                <strong style="color:#111827;">${ownerFirst}</strong>
              </p>

              <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f3f4f6;">
                <p style="color:#9ca3af;font-size:11px;margin:0;">Sent via <a href="https://relationship-app-alpha.vercel.app" style="color:#9ca3af;">SwiftCard</a></p>
              </div>
            </div>
          </div>
        `,
      }).catch(() => {}); // non-blocking
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("API route error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
