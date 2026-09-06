import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PUSH_CATEGORIES, readPushPrefs, type PushCategory } from "@/lib/push-policy";

// Per-category push switches, stored on profiles.customization._push.
//
// Kept out of the generic profile-update path on purpose: this object also
// holds the timezone that quiet hours depend on, and a broad customization
// PATCH that happened to omit _push would silently reset someone's choices.
// Read-modify-write, always, and only the keys named here.

async function currentPush(userId: string) {
  const admin = getAdminSupabase();
  const { data } = await admin.from("profiles").select("customization").eq("id", userId).maybeSingle();
  const customization = (data?.customization ?? {}) as Record<string, unknown>;
  const push = { ...((customization._push ?? {}) as Record<string, unknown>) };
  return { admin, customization, push };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { customization } = await currentPush(user.id);
  return NextResponse.json({ prefs: readPushPrefs(customization) });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { admin, customization, push } = await currentPush(user.id);

  for (const cat of PUSH_CATEGORIES) {
    if (typeof body[cat] === "boolean") push[cat] = body[cat] as boolean;
  }
  if (typeof body.quietHours === "boolean") push.quietHours = body.quietHours;
  // IANA zone, validated by asking the platform to use it. An invalid string
  // here would throw inside quiet-hours every time and silently fall back to
  // UTC — which is the wrong window for anyone outside London.
  if (typeof body.timezone === "string" && body.timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timezone });
      push.timezone = body.timezone;
    } catch { /* keep whatever we had */ }
  }

  const { error } = await admin
    .from("profiles")
    .update({ customization: { ...customization, _push: push } })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: "Not saved" }, { status: 500 });

  return NextResponse.json({ ok: true, prefs: readPushPrefs({ ...customization, _push: push }) });
}

export type PushPrefsResponse = { prefs: Record<PushCategory, boolean> };
