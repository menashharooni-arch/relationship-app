import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { cardEventNotice } from "@/lib/card-event-notify";
import { dispatchCrmEvent } from "@/lib/crm-events";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { isCardActive } from "@/lib/card-active";
import { isRateLimited } from "@/lib/rate-limit";
import { isSelfTraffic, resolveOwnerId } from "@/lib/self-traffic";
import { authoritativeEventIdentity, resolveSessionViewer } from "@/lib/viewer-identity";
import { clientIp } from "@/lib/client-ip";
import { isLikelyBot } from "@/lib/bot-detection";
import { requestLocation } from "@/lib/request-geo";
import { VIEW_VISIT_WINDOW_MS } from "@/lib/view-window";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// The only event types this public endpoint accepts. Anything else used to be
// insertable verbatim — including forged "downloaded_vcard" rows that inflated
// the office contact-save stats and fired un-throttled notifications.
const EVENT_TYPES = new Set(["viewed_card", "downloaded_vcard"]);

// A bounded string from an untrusted body, or null. Every stored field goes
// through this — a non-string or unbounded payload degrades to absent rather
// than becoming a permanent row value.
function str(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

// Public: called from card page without auth
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const card_owner_username = str(body?.card_owner_username, 80);
    const visitor_id = str(body?.visitor_id, 64);
    const event_type = str(body?.event_type, 40);
    const source = str(body?.source, 48);
    const surface: "card" | "links" = body?.surface === "links" ? "links" : "card";
    const visitor_name = str(body?.visitor_name, 120);
    const visitor_email = str(body?.visitor_email, 200);
    const visitor_phone = str(body?.visitor_phone, 40);
    // Query strings carry tokens/session ids on referring sites — keep only
    // origin+path, same privacy stance as site-view's host-only referrers.
    const referrer_url = (str(body?.referrer_url, 300) ?? "").split(/[?#]/)[0] || null;
    const device_info = str(body?.device_info, 250);

    if (!card_owner_username || !event_type || !EVENT_TYPES.has(event_type)) {
      return NextResponse.json({ ok: true });
    }

    // Public, unauthenticated, and both accepted events reach the card owner's
    // lock screen — cap per (IP, card) so a known/guessed username can't be
    // looped to flood that owner's notifications.
    const ip = clientIp(req)
      ?? "unknown";
    if (await isRateLimited(`card-events:${ip}:${card_owner_username}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ ok: true, rateLimited: true });
    }

    // Bot/crawler/synthetic-monitor traffic never counts — checked against the
    // real request header, not the client-supplied device_info.
    if (isLikelyBot(req.headers.get("user-agent"))) {
      return NextResponse.json({ ok: true, bot: true });
    }

    // Speculative loads (prefetch/prerender/link preview) are not people —
    // same guard as /api/views, so the two tables can't disagree about them.
    const purpose = `${req.headers.get("sec-purpose") ?? ""} ${req.headers.get("purpose") ?? ""} ${req.headers.get("x-purpose") ?? ""}`.toLowerCase();
    if (/prefetch|prerender|preview/.test(purpose)) {
      return NextResponse.json({ ok: true, prefetch: true });
    }

    // Only record events for cards that actually serve — /api/views has always
    // enforced this; this route not doing so meant deleted/deactivated slugs
    // still generated events, notifications, and CRM traffic.
    if (!(await isCardActive(card_owner_username))) {
      return NextResponse.json({ ok: true }); // don't reveal which slugs exist
    }

    const admin = getAdminSupabase();

    // Resolve the request's REAL identity once — it drives both decisions
    // below. Null for anonymous visitors, which is the common case.
    const sessionViewer = await resolveSessionViewer(admin);

    // Owner self-activity never records — an owner tapping around their own
    // card must not create events or "saved your contact" notifications to
    // themselves. (Client components also suppress this; server closes it.)
    // Shared, identity-based check — never IP-based (see self-traffic.ts).
    if (sessionViewer && isSelfTraffic(await resolveOwnerId(admin, card_owner_username), sessionViewer.userId)) {
      return NextResponse.json({ ok: true, self: true });
    }

    // ONE VISIT = ONE EVENT = ONE NOTIFICATION. The same visitor re-touching
    // the same card inside the visit window (reload, double-fire, browser
    // retry) is the same event; past the window a return is a genuine repeat
    // and records — and notifies — again. Checked against the DATABASE, not an
    // in-memory throttle: serverless instances don't share memory, which is
    // how one visit used to produce duplicate pushes. Uses the same window as
    // /api/views (view-window.ts) so the dashboard, the contact timeline, and
    // the push notification always agree on whether a view happened.
    const windowStart = new Date(Date.now() - VIEW_VISIT_WINDOW_MS).toISOString();
    if (visitor_id) {
      const { data: dup } = await admin
        .from("card_events")
        .select("id")
        .eq("card_owner_username", card_owner_username)
        .eq("visitor_id", visitor_id)
        .eq("event_type", event_type)
        .gte("created_at", windowStart)
        .limit(1)
        .maybeSingle();
      if (dup) return NextResponse.json({ ok: true, deduped: true });
    } else {
      // No visitor id → nothing to dedupe rows on; hold this path to one event
      // per (IP, card, type) per window so a stripped-down client can't spam.
      if (await isRateLimited(`events-anon:${ip}:${card_owner_username}:${event_type}`, 1, VIEW_VISIT_WINDOW_MS)) {
        return NextResponse.json({ ok: true, deduped: true });
      }
    }

    // WHO viewed: the session decides when there is one. The client-supplied
    // fields come from a device-global localStorage blob that survives account
    // switches, which is how one user's views got recorded under another
    // user's name (see lib/viewer-identity.ts). Anonymous visitors keep the
    // client fields — being recognized after sharing once is a feature.
    const identity = authoritativeEventIdentity(sessionViewer, {
      visitor_name,
      visitor_email,
      visitor_phone,
    });

    // WHERE from: this request's own edge geo headers — never cached, never
    // client-supplied (request-geo.ts). Stored on the event so the
    // notification, the contact timeline, and the dashboard all read the same
    // value; missing data stays null, never a placeholder.
    const location = requestLocation(req);

    const row = {
      card_owner_username,
      visitor_id,
      event_type,
      source: source || "direct_link",
      visitor_name: identity.visitor_name,
      visitor_email: identity.visitor_email,
      visitor_phone: identity.visitor_phone,
      referrer_url,
      device_info,
      location,
      // Explicit, like card_views.viewed_at — the dedup window above and the
      // conversation sort both filter on this; no dependency on a column
      // DEFAULT existing in production.
      created_at: new Date().toISOString(),
    };
    let { error: insertErr } = await admin.from("card_events").insert(row);
    if (insertErr && (insertErr.code === "42703" || insertErr.code === "PGRST204")) {
      // location column not migrated yet (supabase/view-visit-window.sql) —
      // record the event without it rather than dropping it.
      const { location: _unused, ...withoutLocation } = row;
      void _unused;
      ({ error: insertErr } = await admin.from("card_events").insert(withoutLocation));
    }
    if (insertErr) {
      // 23505 = the visit-bucket unique index caught a concurrent duplicate —
      // a normal dedup; the racing request already recorded (and notified).
      if (insertErr.code === "23505") return NextResponse.json({ ok: true, deduped: true });
      console.error("card_events insert failed:", insertErr.message, { card_owner_username });
      // No event row → no notification: the two must never disagree.
      return NextResponse.json({ ok: true });
    }

    // Fire in-app notification — the dedup above already decided this event is
    // genuine news, so every recorded view/save notifies exactly once.
    {
      // card_owner_username is the CARD's slug — resolve through the cards
      // table first (multi-card accounts), then the legacy profile slug.
      const { data: cardRow } = await admin.from("cards").select("user_id").eq("username", card_owner_username).maybeSingle();
      const { data: owner } = cardRow?.user_id
        ? await admin.from("profiles").select("id").eq("id", cardRow.user_id).maybeSingle()
        : await admin.from("profiles").select("id").eq("username", card_owner_username).maybeSingle();

      if (owner?.id) {
        const isView = event_type === "viewed_card";
        // identity, not the raw client field — the notification must name the
        // person who ACTUALLY viewed, never a stale cached identity.
        const notice = cardEventNotice({
          eventType: event_type,
          visitorName: identity.visitor_name,
          source,
          surface,
          location,
        });

        // Flood backstop: the dedup keys on the client-supplied visitor_id, so
        // a caller rotating ids could still ring the owner's phone once per
        // request. One IP can only reach an owner's lock screen a few times an
        // hour — events above the cap still record, they just don't buzz.
        const flooded = await isRateLimited(`notify-ip:${card_owner_username}:${ip}`, 6, 60 * 60 * 1000);

        if (notice && !flooded) {
          const { title, body: noticeBody } = notice;
          const { insertNotification } = await import("@/lib/notify");
          const wrote = await insertNotification({
            user_id: owner.id,
            card_owner: card_owner_username,
            type: notice.type,
            title,
            body: noticeBody,
          });
          // Buzz the phone too, like new_lead and milestones already do — the
          // bell row alone meant the owner only learned about a save the next
          // time they opened the dashboard. Gated on `wrote` so the loser of a
          // dedupe race doesn't push a notification it never created.
          if (wrote) {
            const { sendPushToUser } = await import("@/lib/push");
            await sendPushToUser(owner.id, {
              title,
              body: noticeBody,
              // Deep-link to THIS card's dashboard — a bare /dashboard opened
              // whichever card the owner last had selected, which on a
              // multi-card account could be the wrong one.
              url: `${APP_URL}/dashboard?card=${encodeURIComponent(card_owner_username)}`,
              tag: `card-event-${card_owner_username}`,
            }).catch(() => { /* a dead subscription must never fail the event */ });
          }
          // Mirror this conversation notification to the owner's CRM.
          await dispatchCrmEvent(card_owner_username, {
            type: "conversation.notification",
            event: isView ? "card_viewed" : "contact_saved",
            title,
            body: noticeBody,
            contact: { name: identity.visitor_name, email: identity.visitor_email, phone: identity.visitor_phone },
            source: source || "direct_link",
            location: location ?? undefined,
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

// Private: fetch events for a visitor (card owner only)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = req.nextUrl.searchParams;
    const leadId = params.get("lead_id");
    const visitorIdParam = params.get("visitor_id");
    if (!leadId && !visitorIdParam) return NextResponse.json([], { status: 200 });

    // All the user's card slugs (profile + every card) — a multi-card account
    // must see the visitor's activity on ANY of its cards, not just the primary.
    const usernames = await getOwnerUsernames(user.id);
    const admin = getAdminSupabase();

    // Identity to match on. `lead_id` is the good path: the contact's details
    // stay server-side and we can match on more than one of them. `visitor_id`
    // remains accepted so an older client keeps working.
    let visitorId = visitorIdParam;
    let email: string | null = null;
    let phone: string | null = null;
    if (leadId) {
      const { data: lead } = await admin
        .from("leads")
        .select("visitor_id, email, phone, card_owner")
        .eq("id", leadId)
        .maybeSingle();
      // Scoped to this owner's cards — a lead id from someone else's account
      // must not return their visitor's activity.
      if (!lead || !usernames.includes(lead.card_owner as string)) {
        return NextResponse.json([], { status: 200 });
      }
      visitorId = (lead.visitor_id as string | null) ?? null;
      email = (lead.email as string | null) ?? null;
      phone = (lead.phone as string | null) ?? null;
    }

    // Three narrow queries rather than one .or(): the values are user-supplied
    // emails and phone numbers, and PostgREST's or() takes a comma-separated
    // filter string, so a comma or a quote inside one would change the query's
    // shape rather than just fail to match.
    //
    // Why more than visitor_id at all: that id is per-browser. The same person
    // who shared their details in Safari and later opens the link from
    // Messages is two ids, and matching only the first would show their
    // conversation as empty. Matching what they TOLD us survives the change.
    const cols = "id, event_type, source, visitor_name, visitor_email, created_at";
    const lookups = [
      visitorId ? admin.from("card_events").select(cols).in("card_owner_username", usernames).eq("visitor_id", visitorId) : null,
      email ? admin.from("card_events").select(cols).in("card_owner_username", usernames).ilike("visitor_email", email) : null,
      phone ? admin.from("card_events").select(cols).in("card_owner_username", usernames).eq("visitor_phone", phone) : null,
    ].filter(Boolean);

    const results = await Promise.all(lookups as NonNullable<(typeof lookups)[number]>[]);
    const byId = new Map<string, Record<string, unknown>>();
    for (const r of results) for (const row of r.data ?? []) byId.set(row.id as string, row);

    const merged = [...byId.values()].sort(
      (a, b) => String(a.created_at).localeCompare(String(b.created_at)),
    );
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json([]);
  }
}
