import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, plan } = await req.json();
  if (!userId || !["free", "pro", "enterprise"].includes(plan)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const admin = getAdminSupabase();

  // A directly-set plan is a REAL plan, not a temporary grant. Clear any
  // free-month/trial expiry and the trial bookkeeping flags — otherwise:
  //   • the dashboard shows a bogus "free Pro trial ending" banner, and
  //   • the daily cron downgrades this account back to Free when that stale
  //     plan_expires_at passes, silently undoing the sandbox setting.
  const { data: prof } = await admin.from("profiles").select("customization").eq("id", userId).maybeSingle();
  const cust = { ...((prof?.customization as Record<string, unknown>) ?? {}) };
  delete cust._trial;
  delete cust._trialStarted;
  delete cust._trialEnded;
  delete cust._proWarnedFor;
  delete cust._seqPaused;

  const { error } = await admin
    .from("profiles")
    .update({ plan, plan_expires_at: null, customization: cust })
    .eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
