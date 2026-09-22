import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// The dashboard "Rate us" banner was dismissed or clicked: hide it for 60 days
// (lib/rate-us.ts). Stored on the profile so it holds across devices. Written
// through the admin client because `profiles` accepts no client writes at all
// (supabase/profiles-privileged-column-guard.sql) — scoped to the caller's own
// row, and there is nothing else a caller could set here.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await getAdminSupabase()
    .from("profiles")
    .update({ rate_us_dismissed_at: new Date().toISOString() })
    .eq("id", user.id);
  // Column not migrated yet (supabase/rate-us-banner.sql): the banner simply
  // comes back next load. Never an error the browser has to handle.
  if (error) console.error("[rate-us] dismiss failed:", error.message);
  return NextResponse.json({ ok: true });
}
