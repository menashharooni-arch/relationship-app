import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { mutateCustomization } from "@/lib/profile-customization";
import { isRateLimited } from "@/lib/rate-limit";
import {
  PUSH_ASK_KEY, PUSH_ASK_MAX_AGE_MS, decidePushAsk, isAskableType, laterPushAsk, pushAskQuietUntil, readPushAsk,
  snoozePushAsk, stopPushAsk,
} from "@/lib/push-ask";

// The "turn on notifications" reminder under an important bell row — whether it
// may show, and the record of every time it did. All the rules are in
// lib/push-ask.ts; this route is the only thing that applies them, so a phone
// and a laptop share one budget and one "Don't ask again".

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function accountHasPush(userId: string): Promise<boolean> {
  const { count, error } = await getAdminSupabase()
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  // A failed count must not turn into a reminder for someone who may well
  // already have push on — say "on", and ask another day.
  if (error) return true;
  return (count ?? 0) > 0;
}

/** For the dashboard box: is there any point asking this account at all? */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await getAdminSupabase().from("profiles").select("customization").eq("id", user.id).maybeSingle();
  const ledger = readPushAsk(((data?.customization ?? {}) as Record<string, unknown>)[PUSH_ASK_KEY]);
  const quiet = pushAskQuietUntil(ledger);
  return NextResponse.json({
    pushOn: await accountHasPush(user.id),
    stopped: ledger.stop,
    // Something asked recently (the box or a reminder) — nothing else asks until then.
    quietUntil: quiet && quiet > Date.now() ? new Date(quiet).toISOString() : null,
  });
}

/**
 * { id }                     — may the ask show on this notification? Records it.
 * { action: "later", id }    — "Not now" on that one.
 * { action: "snooze" }       — "Not now" on the dashboard box: a quiet period.
 * { action: "stop" }         — never again ("Don't ask again", a "Don't Allow"
 *                              at the phone's own prompt, or switching push off).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await isRateLimited(`push-ask:${user.id}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown };
  const id = typeof body.id === "string" && UUID.test(body.id) ? body.id : null;

  if (body.action === "stop") {
    const r = await mutateCustomization<unknown>(user.id, PUSH_ASK_KEY, (cur) => stopPushAsk(readPushAsk(cur)) ?? cur);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not saved" }, { status: 500 });
  }

  if (body.action === "snooze") {
    const r = await mutateCustomization<unknown>(user.id, PUSH_ASK_KEY, (cur) => snoozePushAsk(readPushAsk(cur)) ?? cur);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not saved" }, { status: 500 });
  }

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (body.action === "later") {
    const r = await mutateCustomization<unknown>(user.id, PUSH_ASK_KEY, (cur) => laterPushAsk(readPushAsk(cur), id) ?? cur);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not saved" }, { status: 500 });
  }

  // ── Claim ──────────────────────────────────────────────────────────────────
  // Nothing to ask for if a device of theirs already receives pushes.
  if (await accountHasPush(user.id)) return NextResponse.json({ show: false });

  // The row must be THEIRS, unread, recent, and one of the kinds worth a buzz.
  // Checked here, not trusted from the client, so nothing can spend the budget
  // on the wrong notification — or on someone else's.
  const { data: row } = await getAdminSupabase()
    .from("notifications")
    .select("id, type, read, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const age = row ? Date.now() - Date.parse(row.created_at as string) : Infinity;
  if (!row || row.read || !isAskableType(row.type as string) || !(age <= PUSH_ASK_MAX_AGE_MS)) {
    return NextResponse.json({ show: false });
  }

  // Decided INSIDE the verified read-modify-write: two tabs claiming two
  // different rows at once cannot both spend a reminder the budget does not
  // have — the loser re-decides against what the winner wrote.
  let show = false;
  const r = await mutateCustomization<unknown>(user.id, PUSH_ASK_KEY, (cur) => {
    const d = decidePushAsk(readPushAsk(cur), id);
    show = d.show;
    return d.next ?? cur;
  });
  // Unrecorded means uncounted — and an uncounted ask is one that could repeat
  // past the limit. Say no rather than show it.
  if (!r.ok) return NextResponse.json({ show: false });
  return NextResponse.json({ show });
}
