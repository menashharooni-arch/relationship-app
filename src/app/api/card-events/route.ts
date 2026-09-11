import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { cardEventNotice } from "@/lib/card-event-notify";
import { dispatchCrmEvent } from "@/lib/crm-events";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { isCardActive } from "@/lib/card-active";
import { isRateLimited } from "@/lib/rate-limit";
import { isSelfTraffic, resolveOwnerId } from "@/lib/self-traffic";
import { authoritativeEventIdentity, corroboratedContact, resolveSessionViewer } from "@/lib/viewer-identity";
import { clientIp } from "@/lib/client-ip";
import { isLikelyBot, botFamily } from "@/lib/bot-detection";
import { logIngest, type IngestReason, type IngestDecision } from "@/lib/ingest-log";
import { resolveGeo, type GeoResult } from "@/lib/request-geo";
import { VIEW_VISIT_WINDOW_MS } from "@/lib/view-window";
import { recordView } from "@/lib/record-view";
import { notifyVisit, visitKey } from "@/lib/visit-notify";
import type { PushCategory } from "@/lib/push-policy";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// The only event types this public endpoint accepts. Anything else used to be
// insertable verbatim — including forged "downloaded_vcard" rows that inflated
// the office contact-save stats and fired un-throttled notifications.
//
// clicked_link joined them when Swift Links buttons and card external links got
// tracking at all (they had none). It deliberately reaches NO notification:
// cardEventNotice returns null for it, so a tap writes a row, appears in the
// contact's timeline, and never rings anybody's phone. A page of eight links is
// eight taps, and none of them is news.
const EVENT_TYPES = new Set(["viewed_card", "downloaded_vcard", "clicked_link"]);

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
    // WHICH link, for clicked_link. Normalised to a bare host on the client
    // (lib/track-link-click.ts) and re-bounded here like every other stored
    // field, because a client value is a client value.
    const target = str(body?.target, 120);

    if (!card_owner_username || !event_type || !EVENT_TYPES.has(event_type)) {
      // Nothing to log: with no slug there is no entity to attribute a decision
      // to, and a forged event type is noise, not a measurement.
      return NextResponse.json({ ok: true });
    }

    // ── Every exit from here on records WHY ───────────────────────────────────
    // The pipeline used to decline a request and keep no trace, so "why is that
    // view missing?" and "is that view real?" were both unanswerable. `decided`
    // writes one row to analytics_ingest_log and returns the same response the
    // caller always got — the response shape is unchanged, deliberately, because
    // a public endpoint must not start describing its internals to the client.
    // It is fire-and-forget and cannot fail loudly (lib/ingest-log.ts).
    const entityKey = surface === "links" ? `${card_owner_username}__links` : card_owner_username;
    const decided = (
      reason: IngestReason,
      // Named for what it is rather than `body` — the request body is already in
      // scope in this function, and shadowing it here is how that becomes a bug.
      responseFlags: Record<string, boolean> = {},
      extra: Partial<IngestDecision> = {},
    ) => {
      logIngest({
        product: surface === "links" ? "swiftlinks" : "swiftcard",
        entityKey,
        eventType: event_type,
        surface,
        counted: reason === "recorded",
        reason,
        source,
        visitorId: visitor_id,
        ...extra,
      });
      return NextResponse.json({ ok: true, ...responseFlags });
    };

    // Public, unauthenticated, and both accepted events reach the card owner's
    // lock screen — cap per (IP, card) so a known/guessed username can't be
    // looped to flood that owner's notifications.
    const ip = clientIp(req)
      ?? "unknown";
    if (await isRateLimited(`card-events:${ip}:${card_owner_username}`, 20, 10 * 60 * 1000)) {
      return decided("rate_limited", { rateLimited: true });
    }

    // Bot/crawler/synthetic-monitor traffic never counts — checked against the
    // real request header, not the client-supplied device_info.
    const ua = req.headers.get("user-agent");
    if (isLikelyBot(ua)) {
      // The FAMILY, never the User-Agent string: a UA is a device fingerprint,
      // and this log exists to explain decisions, not to profile visitors.
      return decided("bot", { bot: true }, { classification: botFamily(ua), classificationReason: "user_agent" });
    }

    // Speculative loads (prefetch/prerender/link preview) are not people —
    // same guard as /api/views, so the two tables can't disagree about them.
    const purpose = `${req.headers.get("sec-purpose") ?? ""} ${req.headers.get("purpose") ?? ""} ${req.headers.get("x-purpose") ?? ""}`.toLowerCase();
    if (/prefetch|prerender|preview/.test(purpose)) {
      return decided("prefetch", { prefetch: true }, { classificationReason: "purpose_header" });
    }

    // Only record events for cards that actually serve — /api/views has always
    // enforced this; this route not doing so meant deleted/deactivated slugs
    // still generated events, notifications, and CRM traffic.
    if (!(await isCardActive(card_owner_username))) {
      return decided("inactive"); // response says nothing: don't reveal which slugs exist
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
      return decided("self", { self: true }, { identityLevel: "confirmed" });
    }

    // VIEWS: record the card_views row (chart, counters, locations) HERE,
    // through the same function /api/views uses, and only carry on to the
    // notification when it was genuinely recorded. Keyed on the SURFACE
    // ("<slug>__links" for Swift Links), so a card view and a links view by
    // the same visitor are two BARS on the chart. They are still only one
    // NOTIFICATION — one person, one visit, one buzz (lib/visit-notify.ts).
    // Anything not recorded (same-visit reload, self-view) makes no
    // notification either: the bell can never say something the bars don't.
    let viewOutcome: "recorded" | null = null;
    // recordView already resolved this request's geo; reusing its answer means
    // the card_views row and the card_events row can never disagree about where
    // the visit came from OR about how confident that answer is.
    let viewGeo: GeoResult | null = null;
    // The milestone this view crossed, if any. recordView DETECTS it and writes
    // nothing (lib/milestones.ts); folding it into the visit's one notification
    // below is what stopped one view producing two bell rows.
    let milestone: Awaited<ReturnType<typeof recordView>>["milestone"] = null;
    if (event_type === "viewed_card") {
      const viewsKey = surface === "links" ? `${card_owner_username}__links` : card_owner_username;
      const { outcome, geo: recordedGeo, milestone: crossed } = await recordView({
        req, username: viewsKey, visitorId: visitor_id, source, ip,
      });
      milestone = crossed ?? null;
      if (outcome !== "recorded") {
        // recordView's own verdict: deduped (same visit), self, inactive, or a
        // failed write. Its geo answer rides along so even a declined attempt
        // records at what confidence the location WOULD have been known.
        return decided(outcome as IngestReason, { [outcome]: true }, {
          geoAccuracy: recordedGeo?.accuracy ?? null,
          geoSource: recordedGeo?.source ?? null,
          isRelay: recordedGeo?.isRelay ?? null,
        });
      }
      viewOutcome = "recorded";
      viewGeo = recordedGeo ?? null;
    }

    // ONE VISIT = ONE EVENT. The same visitor re-touching
    // the same card inside the visit window (reload, double-fire, browser
    // retry) is the same event; past the window a return is a genuine repeat
    // and records — and notifies — again. Checked against the DATABASE, not an
    // in-memory throttle: serverless instances don't share memory, which is
    // how one visit used to produce duplicate pushes. Uses the same window as
    // /api/views (view-window.ts) so the dashboard, the contact timeline, and
    // the push notification always agree on whether a view happened.
    const windowStart = new Date(Date.now() - VIEW_VISIT_WINDOW_MS).toISOString();
    if (viewOutcome === "recorded") {
      // Already deduped against card_views above (surface-aware).
    } else if (visitor_id) {
      // SURFACE-AWARE, like the card_views dedup. Without the surface term this
      // query answered "has this visitor done this event on this card" and so
      // treated a Swift Links view and a card view as the same event — which is
      // the defect the surface column exists to fix. `.is(null)` is included
      // because every row written before the column existed carries NULL and
      // was, in practice, a card-surface event.
      // TARGET too, for the same reason as surface: two taps on two DIFFERENT
      // links in one visit are two events, and without this the second would be
      // swallowed as a duplicate of the first — the same bug, one day later.
      const base = admin
        .from("card_events")
        .select("id")
        .eq("card_owner_username", card_owner_username)
        .eq("visitor_id", visitor_id)
        .eq("event_type", event_type)
        .gte("created_at", windowStart);
      // Typed .eq()/.is() rather than an .or() filter STRING: these are
      // client-supplied values, and a PostgREST or() takes a comma-separated
      // expression, so a comma or quote inside one would change the query's
      // shape instead of failing to match (the same reasoning the events GET
      // below already spells out).
      const byTarget = target ? base.eq("target", target) : base.is("target", null);
      const { data: dup, error: dupErr } = await (
        surface === "card"
          ? byTarget.or("surface.is.null,surface.eq.card")
          : byTarget.eq("surface", surface)
      ).limit(1).maybeSingle();
      // Column not migrated yet → fall back to the pre-surface question rather
      // than letting a failed filter read as "no duplicate" and record twice.
      if (dupErr && (dupErr.code === "42703" || dupErr.code === "PGRST204")) {
        const { data: legacyDup } = await admin
          .from("card_events")
          .select("id")
          .eq("card_owner_username", card_owner_username)
          .eq("visitor_id", visitor_id)
          .eq("event_type", event_type)
          .gte("created_at", windowStart)
          .limit(1)
          .maybeSingle();
        if (legacyDup) return decided("deduped", { deduped: true }, { classificationReason: "event_window_legacy" });
      } else if (dup) {
        return decided("deduped", { deduped: true }, { classificationReason: "event_window" });
      }
    } else {
      // No visitor id → nothing to dedupe rows on; hold this path to one event
      // per (IP, card, type) per window so a stripped-down client can't spam.
      // The target is part of the key so a visitor with no id can still tap more
      // than one link in half an hour.
      if (await isRateLimited(`events-anon:${ip}:${card_owner_username}:${event_type}:${target ?? ""}`, 1, VIEW_VISIT_WINDOW_MS)) {
        return decided("deduped", { deduped: true }, { classificationReason: "no_visitor_id_ip_window" });
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

    // WHERE from: this request's own edge geo headers, cross-checked against a
    // second IP database — never client-supplied (request-geo.ts). Stored on
    // the event so the notification, the contact timeline, and the dashboard
    // all read the same value; missing data stays null, never a placeholder.
    //
    // For a view this is the IDENTICAL object recordView used, so the two rows
    // cannot drift. For a vCard save (which records no view) it is resolved
    // here, and the per-IP cache in request-geo makes that a cache hit anyway.
    const geo = viewGeo ?? (await resolveGeo(req, ip));
    const location = geo.label;

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
      // ── The columns supabase/analytics-accuracy.sql adds ──────────────────
      // WHICH PAGE. Without this, card_events could not tell a Swift Links view
      // from a card view: the visit-bucket unique index rejected the second
      // surface of one visit as a duplicate, so the event was lost and the
      // contact's timeline said "Viewed your card" for a links view. It is
      // written on every event type, not just views, so a vCard saved off the
      // links page is attributed to the page it happened on.
      surface,
      // Which link was pressed (clicked_link only; NULL for views and saves).
      target,
      // HOW MUCH OF THE LOCATION IS REAL. The label alone cannot say whether
      // "New York, US" is a city or the state two disagreeing databases fell
      // back to — see lib/request-geo.ts and lib/location-display.ts.
      geo_accuracy: geo.accuracy,
      geo_source: geo.source,
    };
    let { error: insertErr } = await admin.from("card_events").insert(row);
    if (insertErr && (insertErr.code === "42703" || insertErr.code === "PGRST204")) {
      // A column this row carries isn't migrated yet — record the event without
      // the optional ones rather than dropping it. Ordered newest-first so the
      // retry is the widest row production can actually accept: location came
      // with view-visit-window.sql, surface/geo_* with analytics-accuracy.sql.
      const { surface: _s, target: _t, geo_accuracy: _ga, geo_source: _gs, ...withoutNew } = row;
      void _s; void _t; void _ga; void _gs;
      ({ error: insertErr } = await admin.from("card_events").insert(withoutNew));
      if (insertErr && (insertErr.code === "42703" || insertErr.code === "PGRST204")) {
        const { location: _unused, ...withoutLocation } = withoutNew;
        void _unused;
        ({ error: insertErr } = await admin.from("card_events").insert(withoutLocation));
      }
    }
    const geoFields: Partial<IngestDecision> = {
      geoAccuracy: geo.accuracy,
      geoSource: geo.source,
      isRelay: geo.isRelay,
    };
    if (insertErr) {
      // 23505 = the visit-bucket unique index caught a concurrent duplicate —
      // a normal dedup; the racing request already recorded (and notified).
      // NOTE this is the one place the log and card_views can honestly differ:
      // for a VIEW the row is already written (recordView committed it) and only
      // the event lost the race, so the decision is recorded as "deduped" while
      // a bar exists. That is the truth, and it is why the reason is stored.
      if (insertErr.code === "23505") {
        return decided("deduped", { deduped: true }, { ...geoFields, classificationReason: "event_unique_index" });
      }
      console.error("card_events insert failed:", insertErr.message, { card_owner_username });
      // No event row → no notification: the two must never disagree.
      return decided("error", {}, geoFields);
    }

    // What the notification layer did with this event, for the decision log:
    // the one question the audit could not answer was "this view recorded — did
    // the owner hear about it, and if not, why?".
    let notified: IngestDecision["notified"] = "not_eligible";
    let identityLevel: IngestDecision["identityLevel"] = "anonymous";

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

        // Is this the very first view this card has ever had?
        //
        // Counted under the SAME key the view was recorded with: card_views
        // stores the Swift Links surface as "<slug>__links", so counting the
        // bare slug here would always return 0 for a links view. 1 = the view
        // just recorded; a failed count returns null, which is not "first".
        //
        // This no longer GATES the push — it only changes the WORDING. A card's
        // first view is the moment the product proves itself to its owner, and
        // it is worth naming as one.
        let firstEver = false;
        if (isView) {
          const { count } = await admin
            .from("card_views")
            .select("id", { count: "exact", head: true })
            .eq("username", surface === "links" ? `${card_owner_username}__links` : card_owner_username);
          firstEver = count === 1;
        }

        // identity, not the raw client field — the notification must name the
        // person who ACTUALLY viewed, never a stale cached identity.
        const notice = cardEventNotice({
          eventType: event_type,
          visitorName: identity.visitor_name,
          source,
          surface,
          location,
          // Without this the copy says "near New York, US" for an answer that
          // only ever meant "somewhere in New York State" (lib/location-display).
          geoAccuracy: geo.accuracy,
          firstEver,
        });

        // Flood backstop: the dedup keys on the client-supplied visitor_id, so
        // a caller rotating ids could still ring the owner's phone once per
        // request. One IP can only reach an owner's lock screen a few times an
        // hour — events above the cap still record, they just don't buzz.
        const flooded = await isRateLimited(`notify-ip:${card_owner_username}:${ip}`, 6, 60 * 60 * 1000);

        // EVERY view is a candidate to buzz; the throttles decide which ones do.
        //
        // This used to be first-view-only — the count === 1 above was the gate —
        // so a view push could fire exactly once in a card's entire lifetime.
        // Someone could share their card at a conference, collect forty views,
        // and their phone would never make a sound. The worry behind that rule
        // was real (nobody wants twenty banners from one printed QR code) but
        // the answer to it was already built and could never engage:
        // push-policy.ts batches views to one an hour inside a five-a-day cap,
        // notifyVisit allows one per visitor per visit, and `flooded` above
        // holds any single IP to six an hour. Four throttles, all now live.
        //
        // A saved contact carries its own category. It is higher intent than a
        // view — someone who saves your card meant to keep you — and it lands
        // as its own alert only when it OPENS the visit (a QR that goes
        // straight to the vCard). Mid-visit it upgrades the row without a
        // second buzz; see the UNCAPPED rule in lib/visit-notify.ts.
        const pushCategory: PushCategory | undefined = isView
          ? "card_view"
          : event_type === "downloaded_vcard"
            ? "contact_saved"
            : undefined;

        // How sure we are WHO this was. A session is proof; a name that came
        // from the visitor's own earlier share is an association, not an
        // identification (the browser is shared, the link is forwardable); no
        // name at all is anonymous. Recorded, never displayed as certainty.
        identityLevel = sessionViewer
          ? "confirmed"
          : identity.visitor_name || identity.visitor_email || identity.visitor_phone
            ? "associated"
            : "anonymous";

        if (flooded) notified = "suppressed";
        if (notice && !flooded) {
          // ONE NOTIFICATION PER PERSON PER VISIT. A view then a save by the
          // same visitor upgrades the notification the owner already has
          // (and replaces the banner) instead of buzzing a second time.
          notified = await notifyVisit({
            userId: owner.id,
            cardOwner: card_owner_username,
            visitorId: visitor_id,
            ip,
            notice: {
              type: notice.type,
              ...(pushCategory ? { pushCategory } : {}),
              title: notice.title,
              body: notice.body,
              // ── The celebration reaches the lock screen, at no extra cost ──
              //
              // This view is ALREADY pushing (pushCategory "card_view", the
              // switch the person agreed to). Until now its headline said
              // "Card viewed" while the bell row a tap away said "50 views —
              // on fire!", so the one moment an owner is unambiguously pleased
              // was the one moment the phone kept to itself.
              //
              // A milestone still cannot CAUSE a push — there is no category
              // that carries a view count and there must not be one — it only
              // retitles the push the view was already sending. Same buzz,
              // same category, same switch, better sentence. The bell row is
              // still upgraded below, which is what writes the once-ever
              // ledger; if that upgrade is what fails, the ledger simply isn't
              // written and the next view announces it again, exactly as
              // before.
              ...(milestone ? { pushTitle: milestone.title } : {}),
              // Deep-link to THIS card's dashboard — a bare /dashboard opened
              // whichever card the owner last had selected, which on a
              // multi-card account could be the wrong one.
              url: `${APP_URL}/dashboard?card=${encodeURIComponent(card_owner_username)}`,
            },
          });
          // Mirror this conversation notification to the owner's CRM. The CRM
          // wants the EVENT, not the merged headline — a milestone is our
          // gamification, not something to write into their pipeline.
          //
          // CONTACT DETAILS ARE CORROBORATED FIRST. This endpoint is public and
          // card slugs are public, so for an anonymous visitor the name, email
          // and phone arrive from the client — by design, so someone who shared
          // once is recognised next time. That is fine for our own bell, which
          // records the difference as `identityLevel` above and never presents
          // it as certain. It is NOT fine to post into Salesforce, HubSpot or a
          // Zapier pipeline: a stranger could POST any slug with any name and
          // email and write a fabricated contact into a customer's system of
          // record. So the details forwarded here come from the LEAD this
          // visitor actually submitted to THIS owner, read server-side — or the
          // event goes without contact details at all, which is honest and
          // still useful (it carries the event, source and location).
          const crmContact = await corroboratedContact({
            admin,
            cardOwner: card_owner_username,
            visitorId: visitor_id,
            sessionViewer,
            identity,
          });
          await dispatchCrmEvent(card_owner_username, {
            type: "conversation.notification",
            event: isView ? "card_viewed" : "contact_saved",
            title: notice.title,
            body: notice.body,
            ...(crmContact ? { contact: crmContact } : {}),
            source: source || "direct_link",
            location: location ?? undefined,
          });

          // ── The milestone this view crossed, folded into the SAME row ──────
          //
          // It used to be its own bell row, written inside recordView, which is
          // how one view produced two notifications a second apart:
          //   21:47:55  milestone_50  "50 views — on fire!"
          //   21:47:56  card_viewed   "Someone viewed your Swift Links."
          //
          // Announced AFTER the view, deliberately: notifyVisit only ever moves
          // a visit UP the rank list, so the view (rank 1) creates the row and
          // the milestone (rank 2) upgrades it in place. Doing it the other way
          // round would leave the owner a bare statistic with no idea who had
          // just been on their card.
          //
          // The copy carries BOTH facts, because both matter and there is now
          // only one row to carry them: the celebration as the headline, the
          // person and place in the body.
          //
          // `milestone:` is the once-ever ledger (notifications.milestone).
          // upgrade() sets it and never clears it, so a lead captured later in
          // this same visit rewrites the type without losing the record that
          // this milestone was announced.
          //
          // Never pushes: no pushCategory, and push-policy.ts has no category
          // that could carry a view count anyway.
          if (milestone) {
            await notifyVisit({
              userId: owner.id,
              cardOwner: card_owner_username,
              visitorId: visitor_id,
              ip,
              notice: {
                type: milestone.type,
                milestone: milestone.type,
                title: milestone.title,
                // Who just visited, the number they took the card past, and one
                // thing to go and do about it. The third sentence is the reason
                // a milestone is worth writing at all — see lib/milestones.ts.
                body: `${notice.body} That's ${milestone.reached.toLocaleString("en-US")} views on /${milestone.slug}. ${milestone.body}`,
                url: `${APP_URL}/dashboard?card=${encodeURIComponent(card_owner_username)}`,
              },
            });
          }
        }
      }
    }

    // The success path. visitKey ties this row to the notification ledger so one
    // visit can be read end to end: the bars, the event, and the buzz.
    return decided("recorded", {}, {
      ...geoFields,
      identityLevel,
      notified,
      visitKey: visitKey({ cardOwner: card_owner_username, visitorId: visitor_id, ip }),
      classification: "human",
      classificationReason: "passed_ingest_gates",
    });
  } catch {
    // The visitor is never told an analytics failure happened, and never will
    // be. Nothing is logged here either: with the body unparsed there is no
    // entity to attribute a decision to.
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
    // `surface` tells the conversation timeline whether a view was the card or
    // the Swift Links page — without it every links view read "Viewed your
    // card" while the owner's notification said "Swift Links viewed". Requested
    // defensively: selecting a column that isn't migrated yet fails the whole
    // query, and an empty conversation is worse than an unlabelled one.
    const WANT = "id, event_type, source, visitor_name, visitor_email, created_at";
    let cols = `${WANT}, surface, target`;
    {
      const probe = await admin.from("card_events").select("surface").limit(1);
      if (probe.error && (probe.error.code === "42703" || probe.error.code === "PGRST204")) cols = WANT;
    }
    const lookups = [
      visitorId ? admin.from("card_events").select(cols).in("card_owner_username", usernames).eq("visitor_id", visitorId) : null,
      email ? admin.from("card_events").select(cols).in("card_owner_username", usernames).ilike("visitor_email", email) : null,
      phone ? admin.from("card_events").select(cols).in("card_owner_username", usernames).eq("visitor_phone", phone) : null,
    ].filter(Boolean);

    const results = await Promise.all(lookups as NonNullable<(typeof lookups)[number]>[]);
    const byId = new Map<string, Record<string, unknown>>();
    // `cols` is built at runtime (the surface probe above), so PostgREST can no
    // longer infer a row type from it — rows are read as the plain records this
    // route already serialised them as.
    for (const r of results) {
      for (const row of (r.data ?? []) as unknown as Record<string, unknown>[]) {
        byId.set(row.id as string, row);
      }
    }

    const merged = [...byId.values()].sort(
      (a, b) => String(a.created_at).localeCompare(String(b.created_at)),
    );
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json([]);
  }
}
