import type { getAdminSupabase } from "@/lib/supabase-admin";
import { INTENT, scoreContact, type IntentInput, type IntentResult } from "@/lib/intent-score";

type Admin = ReturnType<typeof getAdminSupabase>;

// Scores are computed when they are READ (warm-lead plan §2.5): three indexed
// queries for the last INTENT.windowDays of activity stamped with these leads'
// ids, then lib/intent-score.ts in memory. No stored score, no cron, nothing
// to go stale — decay is just arithmetic on "now".
//
// Callers pass leads they have ALREADY scoped to the signed-in owner; nothing
// here widens that. Any failure (including warm-lead-alerts.sql not applied
// yet) degrades to "no activity", i.e. everyone Cold and no reason shown.

const CHUNK = 100;

function chunks<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += CHUNK) out.push(xs.slice(i, i + CHUNK));
  return out;
}

export async function loadIntent(
  admin: Admin,
  leads: { id: string; created_at: string }[],
  now = Date.now(),
): Promise<Map<string, IntentResult>> {
  const inputs = new Map<string, IntentInput>();
  for (const l of leads) inputs.set(l.id, { capturedAt: l.created_at, visits: [], taps: [], downloads: [], replies: [] });
  if (!leads.length) return new Map();

  const since = new Date(now - INTENT.windowDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    for (const ids of chunks(leads.map((l) => l.id))) {
      const [views, events, replies] = await Promise.all([
        admin.from("card_views").select("lead_id, viewed_at").in("lead_id", ids).gte("viewed_at", since).limit(5000),
        admin
          .from("card_events")
          .select("lead_id, event_type, created_at, target, target_label")
          .in("lead_id", ids)
          .in("event_type", ["clicked_link", "downloaded_vcard"])
          .gte("created_at", since)
          .limit(5000),
        admin.from("lead_messages").select("lead_id, created_at").in("lead_id", ids).eq("direction", "in").gte("created_at", since).limit(5000),
      ]);
      for (const v of views.data ?? []) inputs.get(v.lead_id as string)?.visits.push(v.viewed_at as string);
      for (const e of events.data ?? []) {
        const inp = inputs.get(e.lead_id as string);
        if (!inp) continue;
        if (e.event_type === "clicked_link") {
          inp.taps.push({ at: e.created_at as string, host: (e.target as string | null) ?? null, label: (e.target_label as string | null) ?? null });
        } else {
          inp.downloads.push(e.created_at as string);
        }
      }
      for (const r of replies.data ?? []) inputs.get(r.lead_id as string)?.replies.push(r.created_at as string);
    }
  } catch {
    /* degrade to no activity */
  }

  const out = new Map<string, IntentResult>();
  for (const [id, input] of inputs) out.set(id, scoreContact(input, now));
  return out;
}
