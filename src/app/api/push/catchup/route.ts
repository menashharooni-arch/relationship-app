import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { sendPushToUser } from "@/lib/push";
import {
  localHour, quietWindowStart, readPushPrefs, QUIET_END_HOUR, type PushCategory,
} from "@/lib/push-policy";

// ── The morning after quiet hours ────────────────────────────────────────────
//
// Quiet hours hold everything between 10pm and 8am, billing included, and that
// rule is right: nothing SwiftCard has to say is worth waking someone for. But
// held used to mean DROPPED. A lead who handed over their details at 10:30pm
// produced a log line saying "quiet_hours" and then nothing — no banner that
// night, and no banner in the morning either. The owner found out whenever they
// next happened to open the app, which for the notification that matters most
// in the product is the failure this whole file exists to fix.
//
// So: one push, at 8am in the person's OWN timezone, saying what came in while
// they were asleep. One, not a replay — a night of five events must not become
// five buzzes at breakfast.
//
// WHERE THE COPY COMES FROM. Not a queue. Every held push left a bell row
// behind (lib/visit-notify.ts writes the row first and pushes second), so the
// news is already written, already scoped to this user, and already safe to
// show — a locked free lead's row says "… shared their info — open to unlock",
// never an upgrade pitch. Reading it back is strictly better than storing a
// copy of the payload that could drift from it.
//
// WHY THE WINDOW IS EXACTLY QUIET HOURS. A row written at 9:30pm was pushed
// normally; re-announcing it in the morning would be telling someone something
// they were already told. Only rows created after quiet hours began can have
// been held, so only those are candidates.

export const runtime = "nodejs";
export const maxDuration = 60;

type Row = Record<string, unknown>;

/** Written by this route, read by this route: the once-a-day idempotency mark. */
const CATCHUP_OUTCOME = "catchup";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Which bell rows could have been held by quiet hours — i.e. the ones whose
// producer asked for a push. A milestone is deliberately absent: it is bell-only
// news that never had a push to hold (lib/push-policy.ts), and a "50 views"
// banner at 8am would be the product cheering at someone, not their news.
const CATEGORY_FOR_TYPE: Record<string, PushCategory> = {
  card_viewed: "card_view",
  contact_saved: "contact_saved",
  new_lead: "new_lead",
  lead_reply: "lead_reply",
  payment_failed: "billing_problem",
};

/** Biggest news first. Same order as the visit ledger's ranks, plus billing. */
const RANK: Record<PushCategory, number> = {
  billing_problem: 5,
  new_lead: 4,
  lead_reply: 4,
  contact_saved: 3,
  card_view: 1,
  meeting_booked: 2,
};

function destinationFor(category: PushCategory, cardOwner: string | null): string {
  const card = cardOwner ? `?card=${encodeURIComponent(cardOwner)}` : "";
  if (category === "billing_problem") return `${APP_URL}/settings/flows?billing=1`;
  // A contact who is waiting on a reply belongs in Contacts; a view belongs on
  // the dashboard that shows it. Both are the same screens the live pushes use.
  if (category === "new_lead" || category === "lead_reply") return `${APP_URL}/contacts${card}`;
  return `${APP_URL}/dashboard${card}`;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  // The env var must exist AND match — with it unset, `Bearer undefined` would
  // otherwise be a valid credential for anyone who guessed it.
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getAdminSupabase();
  const now = Date.now();
  const counts = { subscribers: 0, atEight: 0, alreadyDone: 0, nothingHeld: 0, sent: 0 };

  // Driven by DEVICES, not by profiles: someone with no push subscription has
  // nothing to catch up on, and this runs every hour of every day.
  const { data: subs, error } = await admin.from("push_subscriptions").select("user_id");
  if (error) {
    console.error("[push] catch-up could not read subscriptions:", error.message);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  const userIds = [...new Set((subs ?? []).map((s) => s.user_id as string))];
  counts.subscribers = userIds.length;

  // Read the profiles in batches rather than one per subscriber. This runs
  // every hour of every day and almost nobody in it is at 8am — a round trip
  // each would be the whole cost of the job, paid 23 times for nothing.
  const profiles = new Map<string, Row>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await admin
      .from("profiles").select("id, plan, customization").in("id", userIds.slice(i, i + 200));
    for (const p of data ?? []) profiles.set(p.id as string, p as Row);
  }

  for (const userId of userIds) {
    try {
      const profile = profiles.get(userId);
      const prefs = readPushPrefs(profile?.customization);

      // Nothing was ever held for someone who switched quiet hours off.
      if (prefs.quietHours === false) continue;
      // NO TIMEZONE, NO CATCH-UP. The send path falls back to UTC when it does
      // not know someone's zone, and guessing here would be worse than the gap
      // it fills: 8am UTC is 4am on the east coast, so the notification meant to
      // rescue a lead from silence would instead be the 4am buzz the quiet-hours
      // rule exists to prevent. TimezoneSync learns the zone on the next launch;
      // until then this person is simply skipped.
      if (!prefs.timezone) continue;
      if (localHour(now, prefs.timezone) !== QUIET_END_HOUR) continue;
      counts.atEight++;

      // Once a day, even if the cron fires twice in the hour.
      const { data: already } = await admin
        .from("push_log")
        .select("id")
        .eq("user_id", userId)
        .eq("outcome", CATCHUP_OUTCOME)
        .gte("created_at", new Date(now - 12 * 3600 * 1000).toISOString())
        .limit(1);
      if (already?.length) { counts.alreadyDone++; continue; }

      // Everything written during quiet hours that they have not already seen.
      // Unread matters: someone who woke at 3am, opened the app and read it all
      // does not need to be told again at 8.
      const { data: rows } = await admin
        .from("notifications")
        .select("type, title, body, card_owner, created_at")
        .eq("user_id", userId)
        .eq("read", false)
        // The real 10pm boundary in their zone, not `now − 10h`: a cron that
        // runs late must still read the whole night (see quietWindowStart).
        .gte("created_at", new Date(quietWindowStart(now, prefs.timezone)).toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      const held = (rows ?? [])
        .map((r) => ({ row: r, category: CATEGORY_FOR_TYPE[r.type as string] }))
        .filter((x): x is { row: typeof x.row; category: PushCategory } =>
          // A category switched OFF is a decision the person made; the morning
          // must not be a way around it.
          Boolean(x.category) && prefs[x.category] !== false);

      if (!held.length) { counts.nothingHeld++; continue; }

      // The biggest thing that happened, newest first within a tie — `rows` is
      // already newest-first, and sort() is stable, so ranking alone is enough.
      const top = [...held].sort((a, b) => RANK[b.category] - RANK[a.category])[0];
      const extra = held.length - 1;

      // MARKED BEFORE SENDING. A crash between the two costs one morning's
      // catch-up; the other order costs a duplicate, and a phone buzzing twice
      // with the same news is the complaint this product has already had.
      await admin.from("push_log").insert({
        user_id: userId,
        category: top.category,
        plan: (profile?.plan as string | null) ?? "free",
        outcome: CATCHUP_OUTCOME,
        endpoints: 0,
      });

      await sendPushToUser(userId, {
        category: top.category,
        // The headline is the news itself, exactly as the bell wrote it ("New
        // contact: Dana Whitfield"). The count goes in the body, where it
        // cannot push the name off the line.
        title: String(top.row.title ?? "While you were away"),
        body: extra > 0
          ? `Plus ${extra} more while you were away.`
          : String(top.row.body ?? ""),
        url: destinationFor(top.category, (top.row.card_owner as string | null) ?? null),
        // One collapse id: a retry replaces this morning's banner instead of
        // stacking a second one beside it.
        tag: "catchup",
      });
      counts.sent++;
    } catch (e) {
      // One account's bad row must never stop the morning for everyone behind it.
      console.error(`[push] catch-up failed for ${userId}:`, e);
    }
  }

  return NextResponse.json(counts);
}
