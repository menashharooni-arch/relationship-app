import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { DEVICE_COOKIE, isDeviceId } from "@/lib/device";

// Signing a device out of the account.
//
// Deliberately NOT the admin client. This runs as the signed-in user, so RLS on
// user_devices is the thing that stops one account removing another's devices —
// one rule, enforced by the database, rather than an ownership check written
// out by hand in a route that could forget it.

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_devices")
    .select("device_id, label, is_native, first_seen, last_seen")
    .order("last_seen", { ascending: false });

  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ devices: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { deviceId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : null;
  if (!isDeviceId(deviceId)) return NextResponse.json({ error: "bad-request" }, { status: 400 });

  const { error } = await supabase
    .from("user_devices")
    .delete()
    .eq("user_id", user.id)
    .eq("device_id", deviceId);

  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  // Removing THIS device is a real thing to want (signing this browser out of
  // the account from the device itself), and it has to actually end the session
  // here — otherwise the slot is freed and immediately re-claimed on the next
  // navigation, and the button looks broken.
  const current = req.cookies.get(DEVICE_COOKIE)?.value;
  const removedSelf = current === deviceId;
  if (removedSelf) await supabase.auth.signOut();

  const res = NextResponse.json({ ok: true, removedSelf });
  if (removedSelf) res.cookies.delete(DEVICE_COOKIE);
  return res;
}
