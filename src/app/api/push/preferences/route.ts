import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { writePushPrefs } from "@/lib/push-prefs";
import { PUSH_CATEGORIES, readPushPrefs, type PushCategory } from "@/lib/push-policy";

// Per-category push switches, stored on profiles.customization._push.
//
// Kept out of the generic profile-update path on purpose: this object also
// holds the timezone that quiet hours depend on, and a broad customization
// PATCH that happened to omit _push would silently reset someone's choices.
// The write goes through lib/push-prefs.ts, which reads back what it wrote —
// that generic path is not the only writer of this column, and losing to one of
// them used to look exactly like a successful save.

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data } = await admin.from("profiles").select("customization").eq("id", user.id).maybeSingle();
  return NextResponse.json({ prefs: readPushPrefs(data?.customization) });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const result = await writePushPrefs(user.id, (push) => {
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
  });

  if (!result.ok) return NextResponse.json({ error: "Not saved" }, { status: 500 });
  return NextResponse.json({ ok: true, prefs: result.prefs });
}

export type PushPrefsResponse = { prefs: Record<PushCategory, boolean> };
