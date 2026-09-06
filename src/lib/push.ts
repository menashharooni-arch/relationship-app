import webpush from "web-push";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isApnsEndpoint, sendApnsNotification } from "@/lib/apns";
import { assertSafeUrl } from "@/lib/safe-fetch";
import {
  decidePush, fitBody, readPushPrefs, UNCAPPED,
  type PushCategory,
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
  vcardUrl?: string;
  tag?: string;
  category: PushCategory;
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
  let lastFirstViewAt: number | null = null;
  try {
    const { data: recent } = await admin
      .from("push_log")
      .select("category, created_at")
      .eq("user_id", userId)
      .eq("outcome", "sent")
      .gte("created_at", since);
    for (const row of recent ?? []) {
      const cat = row.category as PushCategory;
      if (!UNCAPPED.includes(cat)) cappedSentToday++;
      if (cat === "first_view") {
        const at = Date.parse(row.created_at as string);
        if (!lastFirstViewAt || at > lastFirstViewAt) lastFirstViewAt = at;
      }
    }
  } catch {
    // Log table missing (pre-migration): no history means no cap and no batch
    // window. Sending is the safe direction — the alternative is silently
    // dropping every notification in the product.
  }

  const verdict = decidePush({ category: payload.category, prefs, cappedSentToday, lastFirstViewAt });
  if (!verdict.send) {
    await log(verdict.reason);
    return;
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) { await log("no_subscription"); return; }

  // The lock screen truncates; do it ourselves on a word boundary.
  payload = { ...payload, body: fitBody(payload.body) };

  // Native iOS devices register with an "apns:<token>" endpoint and go through
  // APNs; browser subscriptions keep going through web-push. Both prune their
  // dead endpoints the same way.
  const apnsSubs = subs.filter((s) => isApnsEndpoint(s.endpoint));
  const webSubs = subs.filter((s) => !isApnsEndpoint(s.endpoint));

  const sends: Promise<unknown>[] = [];

  for (const sub of apnsSubs) {
    sends.push(
      sendApnsNotification(sub.endpoint, payload).then(async (result) => {
        if (result === "gone") {
          await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        return result;
      })
    );
  }

  if (webSubs.length && process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    webpush.setVapidDetails(
      "mailto:hello@swiftcard.me",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    const payloadStr = JSON.stringify(payload);
    for (const sub of webSubs) {
      sends.push(
        endpointIsSafeToSend(sub.endpoint).then((safe): Promise<unknown> => {
          if (!safe) return Promise.resolve("blocked-endpoint");
          return webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payloadStr
          ).catch(async (err) => {
            if (err.statusCode === 404 || err.statusCode === 410) {
              await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            }
            throw err;
          });
        })
      );
    }
  }

  if (!sends.length) { await log("no_deliverable_endpoint"); return; }
  const results = await Promise.allSettled(sends);
  const delivered = results.filter((r) => r.status === "fulfilled" && r.value !== "blocked-endpoint").length;
  await log(delivered ? "sent" : "failed", delivered);
  return results;
}
