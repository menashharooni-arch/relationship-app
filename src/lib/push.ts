import webpush from "web-push";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isApnsEndpoint, sendApnsNotification } from "@/lib/apns";

export async function sendPushToUser(userId: string, payload: {
  title: string;
  body: string;
  url: string;
  vcardUrl?: string;
  tag?: string;
}) {
  const admin = getAdminSupabase();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return;

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
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr
        ).catch(async (err) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
          throw err;
        })
      );
    }
  }

  if (!sends.length) return;
  return Promise.allSettled(sends);
}
