import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isRateLimited } from "@/lib/rate-limit";
import { assertSafeUrl } from "@/lib/safe-fetch";

// A browser push endpoint (or apns:<token> row) belongs to a DEVICE; on a
// shared device the signed-in user legitimately changes, so the upsert
// transfers the row. Endpoints are high-entropy URLs, so hijacking someone
// else's requires the endpoint itself to have leaked — but validate shape AND
// destination: the server later POSTs to this URL via web-push, so an
// unchecked https host is a blind-SSRF primitive into internal services.
// Returns true only for an apns: token or a public-internet https URL.
async function isSafePushEndpoint(endpoint: unknown): Promise<boolean> {
  if (typeof endpoint !== "string" || endpoint.length > 1024) return false;
  if (endpoint.startsWith("apns:")) return endpoint.length > 20;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  // Reject private/loopback/link-local/metadata hosts (also blocks a name
  // that resolves to a private IP — DNS-rebinding defense). Delivery in
  // lib/push.ts re-checks at send time to close the rebinding-at-send gap.
  try {
    await assertSafeUrl(url);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await isRateLimited(`push-subscribe:${user.id}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { endpoint, p256dh, auth } = await req.json();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Missing subscription fields" }, { status: 400 });
  }
  if (!(await isSafePushEndpoint(endpoint))) {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  }

  const admin = getAdminSupabase();
  await admin.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh, auth },
    { onConflict: "endpoint" }
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  const admin = getAdminSupabase();
  // Authorized by ENDPOINT POSSESSION, not row ownership. The endpoint is a
  // high-entropy capability that only the device holding it can present, and
  // this is how an account SWITCH severs the PREVIOUS account's binding: the
  // new session presents the device's endpoint but does not own the old row
  // (see lib/push-device.ts) — an .eq("user_id") filter here silently kept the
  // old account's notifications flowing to a device it no longer occupies.
  // Deleting can only ever STOP pushes to the presenting device; it exposes
  // nothing and transfers nothing.
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
