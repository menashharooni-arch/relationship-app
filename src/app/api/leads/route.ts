import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { syncLeadToGoogle } from "@/lib/sync-google";
import { syncLeadToHubSpot } from "@/lib/sync-hubspot";
import { getSourceLabel } from "@/lib/source-labels";
import { sendPushToUser } from "@/lib/push";
import { PLAN_LIMITS, LOCKED_LEAD_TAG, isPaidPlan } from "@/lib/plan";
import { readUsage, bumpUsage } from "@/lib/usage";
import { cardWithinPlanLimit, ownerIsDeleted } from "@/lib/card-active";
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
        title: locked ? "New lead locked" : `New contact: ${name}`,
        body: locked
          ? "You've hit your 5 free leads this month. Upgrade to Pro to unlock this one — and never miss the next."
          : `${name} shared their info with you${sourceStr}.`,
      }).catch(() => {});

      // Push notification — phone buzz + optional vCard save (teaser when locked)
      if (insertedLead?.id) {
        const vcardUrl = `${APP_URL}/api/leads/vcard?id=${insertedLead.id}`;
        sendPushToUser(ownerProfile.id, {
          title: locked ? "New lead locked" : `New contact: ${name}`,
          body: locked
            ? "Upgrade to Pro to unlock this lead."
            : (phone ? `${phone}${company ? ` · ${company}` : ""}` : (email ?? "Tap to save")),
          url: `${APP_URL}/dashboard`,
          ...(locked ? {} : { vcardUrl }),
          tag: `lead-${insertedLead.id}`,
        }).catch(() => {});
      }
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
