import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { syncLeadToGoogle } from "@/lib/sync-google";
import { syncLeadToHubSpot } from "@/lib/sync-hubspot";
import { getSourceLabel } from "@/lib/source-labels";
import { sendPushToUser } from "@/lib/push";
import { PLAN_LIMITS, LOCKED_LEAD_TAG, isPaidPlan } from "@/lib/plan";
import { readUsage, bumpUsage } from "@/lib/usage";
import { cardIsOffline, cardWithinPlanLimit, ownerIsDeleted } from "@/lib/card-active";
import { isRateLimited } from "@/lib/rate-limit";
import { isZapierWebhookUrl } from "@/lib/safe-fetch";
import { clientIp } from "@/lib/client-ip";
import { isLikelyBot } from "@/lib/bot-detection";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, company, message, card_owner, tags, source, visitor_id, sms_consent } = await req.json();

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

    // SMS consent (TCPA/CTIA): the share forms carry an affirmative, unchecked-
    // by-default checkbox. Declining it must not block the share — but the lead
    // is created with the sms-paused tag, the same per-contact switch the
    // follow-up cron already honors, so automated texts skip them until they
    // (or the owner, at the contact's request) flip it. Only an EXPLICIT false
    // pauses: an absent field means an older/other caller that never asked, and
    // changing those would silently rewire existing capture paths. Kept OUT of
    // safeTags — that array also feeds the Zapier webhook payload, and internal
    // system tags must not start appearing in customers' Zaps.
    // SMS is OPT-IN (TCPA): an automated marketing text only ever goes to a
    // contact who affirmatively consented — the checkbox. Checked → sms-ok
    // (the one tag the cron requires to send a text); unchecked/declined →
    // sms-paused. An ABSENT field (a capture path that never asked — scanner,
    // manual add, legacy) records NEITHER, so the cron's "requires sms-ok"
    // rule means those contacts are never auto-texted. Email is unaffected —
    // it's opt-in-by-sharing, stated on the form.
    const smsConsented = sms_consent === true;
    const smsDeclined = sms_consent === false;

    // Rate limit: same IP submitting to the same card too frequently.
    // card_owner is normalized so "Alice " vs "alice" can't mint fresh buckets.
    const ip = clientIp(req);
    const rateKey = `${ip}:${card_owner.trim().toLowerCase()}`;
    if (await isRateLimited(rateKey)) {
      return NextResponse.json({ error: "Too many submissions. Please wait a few minutes." }, { status: 429 });
    }

    // Bot/crawler/synthetic-monitor traffic must not create a lead — unlike
    // an inflated view count, a fake lead here pushes a real notification,
    // push alert, and CRM/Zapier sync to the card owner (code review: this
    // was the only public ingest route without the bot check already applied
    // to views/card-events/analytics-event).
    if (isLikelyBot(req.headers.get("user-agent"))) {
      return NextResponse.json({ error: "Unable to submit right now." }, { status: 400 });
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
    // select("*") so the is_offline kill-switch is actually present on the row —
    // an explicit column list would silently omit it (and would error outright on
    // a pre-migration schema), leaving lead capture open on an offline card.
    const { data: cardRow } = await admin.from("cards").select("*").eq("username", card_owner).maybeSingle();
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
    // A card an office admin took offline captures no leads either — its page
    // 404s, so this API must not stay open as a back door.
    if (cardIsOffline(cardRow)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (cardRow && !(await cardWithinPlanLimit(cardRow.id, cardRow.user_id, ownerProfile.plan))) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Idempotency: a double-submit (double-tap, slow-response retry, or a
    // client that fires on both click and form-submit) must not create two
    // leads — that means two notifications, two pushes, and two CRM/Zapier
    // syncs for one person. The (IP, card) rate limit is 3/10min, which is
    // deliberately loose enough to let two DIFFERENT people at one venue (shared
    // NAT IP) both submit — so it can't be the dedup. Instead, treat a lead as a
    // duplicate of a very recent one from the SAME person to the SAME card:
    // matched on visitor_id when present (the first-party per-browser id, so two
    // different people never collide), else on the phone number (unique to a
    // person). Window kept short (5 min) so a genuine second visit later still
    // captures. On a hit we return success WITHOUT inserting — the visitor
    // already succeeded the first time, so re-reporting success is correct and
    // avoids a "something went wrong" re-submit loop.
    const DEDUP_WINDOW_MS = 5 * 60 * 1000;
    // Duplicate = same phone to the same card within the window (and same
    // visitor_id too when the browser supplied one, for extra precision). Same
    // phone → same person, so this catches the double-submit without dropping a
    // genuinely different second contact. A corrected re-submit with a DIFFERENT
    // phone is not a duplicate and still captures.
    const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    let dupQuery = admin
      .from("leads")
      .select("id, tags")
      .eq("card_owner", card_owner)
      .eq("phone", phone)
      .gte("created_at", dedupSince)
      .limit(1);
    if (visitor_id) dupQuery = dupQuery.eq("visitor_id", visitor_id);
    const { data: recentDup } = await dupQuery;
    if (recentDup?.length) {
      // A deduped re-submit can still carry a CHANGED consent choice (they
      // shared without the SMS box, then immediately re-submitted with it
      // checked, or vice versa). Reconcile the existing row's sms-paused tag to
      // the latest explicit choice so the duplicate-drop never drops consent.
      if (typeof sms_consent === "boolean") {
        const dup = recentDup[0] as { id: string; tags: string[] | null };
        const curTags = Array.isArray(dup.tags) ? dup.tags : [];
        // Set the consent pair to the latest explicit choice: consent → sms-ok
        // (and clear sms-paused); decline → sms-paused (and clear sms-ok).
        const base = curTags.filter((t) => t !== "sms-ok" && t !== "sms-paused");
        const nextTags = Array.from(new Set([...base, sms_consent ? "sms-ok" : "sms-paused"]));
        const changed = nextTags.length !== curTags.length || nextTags.some((t) => !curTags.includes(t));
        if (changed) {
          await admin.from("leads").update({ tags: nextTags }).eq("id", dup.id);
        }
      }
      return NextResponse.json({ success: true, deduped: true });
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
        // tagged locked so the dashboard blurs them behind Pro. SMS consent
        // rides in as sms-ok (opted in) or sms-paused (declined) — never via
        // safeTags (see above); neither, if the form didn't ask.
        tags: [
          ...safeTags,
          ...(smsConsented ? ["sms-ok"] : []),
          ...(smsDeclined ? ["sms-paused"] : []),
          "unread",
          ...(locked ? [LOCKED_LEAD_TAG] : []),
        ],
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
