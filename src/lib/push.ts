import webpush from "web-push";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isApnsEndpoint, sendApnsDetailed } from "@/lib/apns";
import { reportError as reportServerError } from "@/lib/report-error";
import { assertSafeUrl } from "@/lib/safe-fetch";
import { isPaidPlan } from "@/lib/plan";
import { stripLocationMarks, withoutLocation } from "@/lib/location-privacy";
import {
  decidePush, fitBody, readPushPrefs, pushCardTag, cardTagLine, MAX_TITLE_CHARS, UNCAPPED, VIEW_ROLLUP_TAG,
  type PushCategory, type PushCardRow,
} from "@/lib/push-policy";

// web-push POSTs to whatever host the stored endpoint names. Endpoints are
// validated at registration, but a hostname can rebind to a private IP after
// storage — so re-assert public-internet safety at SEND time too (SSRF
// defense-in-depth). Rejects quietly: a bad endpoint just isn't delivered.
async function endpointIsSafeToSend(endpoint: string): Promise<boolean> {
  try {
    await assertSafeUrl(new URL(endpoint));
    return true;
  } catch {
    return false;
  }
}

/**
 * Send one push, if policy allows it.
 *
 * EVERY push in the product goes through here, and every one of them must name
 * its category — that is what makes "only these five things may interrupt
 * someone" enforceable rather than a comment. There is deliberately no way to
 * send an uncategorised push.
 *
 * NO PLAN CHECK. Free, trial, Pro and Office are treated identically: the
 * subscription rows are read by user id and nothing here looks at a plan. The
 * plan is recorded on the log line so we can prove that, not to branch on it.
 */
export async function sendPushToUser(userId: string, payload: {
  title: string;
  body: string;
  url: string;
  tag?: string;
  /** Set by the policy, never by a caller: no sound, no screen — see PushMode. */
  silent?: boolean;
  category: PushCategory;
  /**
   * The slug of the card this is about. For an account with 2+ cards the push
   * then SAYS which card ("Card: Work") — see pushCardTag. Every producer that
   * knows the card passes it; account-level news (billing) has none.
   */
  cardOwner?: string | null;
  /** The 8am catch-up only — see PolicyInput.catchup. */
  catchup?: boolean;
}) {
  const admin = getAdminSupabase();

  // One read for the switches, the timezone and the plan. The plan is for the
  // log only — see the note above.
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, customization")
    .eq("id", userId)
    .maybeSingle();
  const prefs = readPushPrefs(profile?.customization);
  const plan = (profile?.plan as string | null) ?? "free";
  const paid = isPaidPlan(plan);

  const log = async (outcome: string, endpointCount = 0) => {
    try {
      await admin.from("push_log").insert({
        user_id: userId,
        category: payload.category,
        plan,
        outcome,
        endpoints: endpointCount,
      });
    } catch { /* a logging failure must never stop a notification */ }
  };

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  let cappedSentToday = 0;
  let lastViewPushAt: number | null = null;
  let lastViewUpdateAt: number | null = null;
  // Every view that reached this function since the hour's alert: the alert
  // itself, the silent updates after it, and the ones the update throttle held
  // back. That total is what the running-count banner says, so it must count
  // the held-back ones too or the number visibly skips.
  const viewAttemptsSinceAlert: number[] = [];
  try {
    const { data: recent } = await admin
      .from("push_log")
      .select("category, outcome, created_at")
      .eq("user_id", userId)
      // "sent" alone can no longer answer these questions: a silent update logs
      // "rollup" and a held-back one logs "batched", and both are views that
      // happened. Still a closed list — a "no_subscription" row is not a view.
      .in("outcome", ["sent", "rollup", "batched"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    for (const row of recent ?? []) {
      const cat = row.category as PushCategory;
      const outcome = row.outcome as string;
      const at = Date.parse(row.created_at as string);
      // The cap counts real interruptions only — never a silent update, never
      // something that was suppressed.
      if (outcome === "sent" && !UNCAPPED.includes(cat)) cappedSentToday++;
      if (cat !== "card_view") continue;
      if (outcome === "sent" && (!lastViewPushAt || at > lastViewPushAt)) lastViewPushAt = at;
      if (outcome === "rollup" && (!lastViewUpdateAt || at > lastViewUpdateAt)) lastViewUpdateAt = at;
      viewAttemptsSinceAlert.push(at);
    }
  } catch {
    // Log table missing (pre-migration): no history means no cap and no batch
    // window. Sending is the safe direction — the alternative is silently
    // dropping every notification in the product.
  }

  const verdict = decidePush({
    category: payload.category, prefs, cappedSentToday, lastViewPushAt, lastViewUpdateAt,
    catchup: payload.catchup === true,
  });
  if (!verdict.send) {
    await log(verdict.reason);
    return;
  }

  // ── The silent running count ────────────────────────────────────────────
  // Same notification, replaced in place: one collapse id for the counter, no
  // sound, and the newest view's own sentence underneath the number. The alert
  // that opened the hour keeps its VISIT tag and is left alone — it may since
  // have been upgraded to "…shared their info with you", and overwriting that
  // with a view count would be a downgrade.
  const isUpdate = verdict.mode === "update";
  const alertAt = lastViewPushAt;
  const viewsThisHour = alertAt
    ? viewAttemptsSinceAlert.filter((at) => at >= alertAt).length + 1
    : 1;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) { await log("no_subscription"); return; }

  // The lock screen truncates BOTH lines; do it ourselves, on word boundaries.
  // Title and body have different budgets because the OS gives them different
  // room — trimming only the body still let a long name be cut mid-word.
  //
  // An update's headline is the COUNT ("6 views in the last hour") and its body
  // stays the newest view's own sentence, so the banner keeps saying who and
  // where while the number climbs. "views", never "people": card_views counts
  // visits, and one person returning after thirty minutes counts again — the
  // same honesty rule the milestones copy is held to (lib/milestones.ts).
  // WHERE A LOCK SCREEN LOSES THE LOCATION. The place a view came from is a
  // Pro feature, and a push cannot blur anything — so for a Free account the
  // whole fragment comes out and the sentence closes up ("Sam viewed your
  // Swift Links."). A paid account keeps it, with the invisible marks removed.
  // Every push in the product goes through here, so no producer can forget.
  const plainBody = (s: string) => (paid ? stripLocationMarks(s) : withoutLocation(s));
  payload = {
    ...payload,
    title: fitBody(isUpdate ? `${viewsThisHour} views in the last hour` : plainBody(payload.title), MAX_TITLE_CHARS),
    body: fitBody(plainBody(payload.body)),
    ...(isUpdate ? { tag: VIEW_ROLLUP_TAG, silent: true } : {}),
  };

  // WHICH CARD. One extra read, and only once we know a device will receive
  // this. Best-effort: a failed lookup sends the notification untagged rather
  // than not at all.
  let cardLine: string | null = null;
  if (payload.cardOwner) {
    try {
      const { data: cards } = await admin
        .from("cards")
        .select("username, label, name, company")
        .eq("user_id", userId);
      const tag = pushCardTag((cards ?? []) as PushCardRow[], payload.cardOwner);
      cardLine = tag ? cardTagLine(tag) : null;
    } catch { /* untagged */ }
  }
  // iOS has a real line for it (aps.alert.subtitle, between title and body). A
  // browser notification has only title + body, so there it leads the body on a
  // line of its own — never the title, which the OS truncates first.
  const apnsPayload = { ...payload, ...(cardLine ? { subtitle: cardLine } : {}) };
  const webPayload = cardLine ? { ...payload, body: `${cardLine}\n${payload.body}` } : payload;

  // Native iOS devices register with an "apns:<token>" endpoint and go through
  // APNs; browser subscriptions keep going through web-push. Both prune their
  // dead endpoints the same way.
  const apnsSubs = subs.filter((s) => isApnsEndpoint(s.endpoint));
  const webSubs = subs.filter((s) => !isApnsEndpoint(s.endpoint));

  // Every send resolves to whether it REACHED a device. The old accounting
  // counted any settled promise as delivered, so an APNs rejection — including
  // the one that deleted the subscription — was logged as "sent": the log said
  // pushes were going out for a week in which not one arrived.
  const sends: Promise<boolean>[] = [];
  const failures: string[] = [];

  for (const sub of apnsSubs) {
    sends.push(
      sendApnsDetailed(sub.endpoint, apnsPayload).then(async (r) => {
        if (r.result === "sent") return true;
        if (r.result === "gone") {
          // Both Apple environments disowned it, or Apple said Unregistered.
          // An uninstalled app is ordinary life, not a fault — prune and move on.
          await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          return false;
        }
        failures.push(`apns ${r.result} ${r.status} ${r.reason}`.trim());
        return false;
      }).catch((e) => { failures.push(`apns threw ${e instanceof Error ? e.message : String(e)}`); return false; })
    );
  }

  if (webSubs.length && process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    webpush.setVapidDetails(
      "mailto:hello@swiftcard.me",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    const payloadStr = JSON.stringify(webPayload);
    for (const sub of webSubs) {
      sends.push(
        endpointIsSafeToSend(sub.endpoint).then(async (safe): Promise<boolean> => {
          if (!safe) { failures.push("web blocked-endpoint"); return false; }
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payloadStr
            );
            return true;
          } catch (err) {
            const code = (err as { statusCode?: number })?.statusCode;
            if (code === 404 || code === 410) {
              // Expired browser subscription: prune, not a fault.
              await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
              return false;
            }
            failures.push(`web ${code ?? "error"}`);
            return false;
          }
        })
      );
    }
  }

  if (!sends.length) { await log("no_deliverable_endpoint"); return; }
  const results = await Promise.allSettled(sends);
  const delivered = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  // A push nobody received is invisible by nature — the owner just stops hearing
  // from the product. Put Apple's / the browser's own reason where the uptime
  // and nightly checks already look (error_events), once per failed send.
  if (failures.length) {
    await reportServerError("push.delivery", new Error(`push not delivered (${payload.category}): ${[...new Set(failures)].join(" | ")}`), { userId }).catch(() => {});
  }
  // "rollup" is its own outcome and NOT "sent", deliberately: `sent` is what
  // opens and closes the one-alert-an-hour window and what the daily cap counts,
  // and a silent update must do neither — otherwise a busy afternoon would slide
  // the window forever and the owner would never hear the next real alert.
  // A rollup that reached nobody logs "failed" like anything else, so the
  // throttle doesn't hold back the next attempt on the strength of a no-op.
  await log(delivered ? (isUpdate ? "rollup" : "sent") : "failed", delivered);
  return results;
}
