import webpush from "web-push";
import { getAdminSupabase } from "@/lib/supabase-admin";

export async function sendPushToUser(userId: string, payload: {
  title: string;
  body: string;
  url: string;
  vcardUrl?: string;
  tag?: string;
}) {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;

  webpush.setVapidDetails(
    "mailto:hello@swiftcard.me",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const admin = getAdminSupabase();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return;

  const payloadStr = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr
      ).catch(async (err) => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        throw err;
      })
    )
  );

  return results;
}
