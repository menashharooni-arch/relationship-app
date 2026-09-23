import { markPhrase, markPlace } from "@/lib/location-privacy";
import { localHour } from "@/lib/push-policy";

// ── The Monday recap — the one digest allowed on a phone ────────────────────
//
// Owner, 2026-09-22: office admins get their team's week, weekly only; a Free
// account's notifications should show what they are missing. So one recap a
// week, on its own switch (push-policy weekly_recap), Monday at 9am in the
// person's own zone (api/push/recap):
//
//   everyone      "Your week: 14 views · 2 contacts" / "Top spot in Austin, TX ·
//                 4 places in all." — on a Free lock screen the place is shaded
//                 ("Top spot in ▒▒▒▒▒, ▒▒ · 4 places in all.", teaseLocation)
//                 and blurred in the bell. The place is MARKED here, so every
//                 existing privacy rule applies with no new code.
//   Office admin  the TEAM's week instead of their own — never both, one
//                 Monday push each.
//
// Nothing is sent for a week with nothing in it: "0 views" is not news, it is
// a nudge, and nudges are not allowed on a phone.
//
// Pure, so the copy and the "is it Monday 9am for them" rule are testable.

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

export function personalRecapCopy(input: {
  views: number;
  contacts: number;
  /** Place labels, most views first. */
  places: string[];
}): { title: string; body: string } | null {
  if (input.views <= 0 && input.contacts <= 0) return null;
  const title = `Your week: ${plural(input.views, "view")}${input.contacts ? ` · ${plural(input.contacts, "contact")}` : ""}`;
  const top = input.places[0];
  const body = top
    ? `Top spot${markPhrase(` in ${markPlace(top)}`)}${input.places.length > 1 ? ` · ${input.places.length} places in all` : ""}.`
    : input.contacts
      ? `${plural(input.contacts, "person", "people")} shared their details with you.`
      : "Open SwiftCard to see the week.";
  return { title, body };
}

export function teamRecapCopy(input: {
  views: number;
  leads: number;
  /** The teammate with the most leads (else views) this week, if anyone did anything. */
  top: { name: string; leads: number; views: number } | null;
  /** Teammates whose cards had no views at all this week. */
  quiet: number;
}): { title: string; body: string } | null {
  if (input.views <= 0 && input.leads <= 0) return null;
  const title = `Team week: ${plural(input.views, "view")} · ${plural(input.leads, "lead")}`;
  const first = input.top ? (input.top.name.trim().split(/\s+/)[0] || "A teammate") : null;
  const lead = input.top && first
    ? input.top.leads > 0
      ? `${first} led with ${plural(input.top.leads, "lead")}.`
      : `${first} had the most views (${input.top.views.toLocaleString("en-US")}).`
    : "";
  const quiet = input.quiet > 0 ? ` ${plural(input.quiet, "teammate")} had no views.` : "";
  return { title, body: (lead + quiet).trim() || "See the full week in your Admin console." };
}

/** Monday, 9am or 10am in their zone (10 covers a late scheduler). */
export function isRecapHour(now: number, timezone: string | null | undefined): boolean {
  if (!timezone) return false;
  let weekday = "";
  try {
    weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(new Date(now));
  } catch { return false; }
  const h = localHour(now, timezone);
  return weekday === "Mon" && (h === 9 || h === 10);
}

/** The daily team check runs at 9–10am in the owner's zone (UTC 13–14 ≈ US Eastern when unknown). */
export function isTeamCheckHour(now: number, timezone: string | null | undefined): boolean {
  const h = timezone ? localHour(now, timezone) : new Date(now).getUTCHours() - 4;
  return h === 9 || h === 10;
}

/**
 * Monday's team check: when the team's week goes into the ADMIN BELL, with or
 * without a phone. The same hour and fallback as the daily team check, on the
 * owner's Monday (US Eastern when their zone is unknown).
 */
export function isTeamRecapBellHour(now: number, timezone: string | null | undefined): boolean {
  if (!isTeamCheckHour(now, timezone)) return false;
  let weekday = "";
  try {
    weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone || "America/New_York", weekday: "short" }).format(new Date(now));
  } catch { return false; }
  return weekday === "Mon";
}

/** Most frequent labels first. */
export function rankPlaces(labels: Array<string | null | undefined>): string[] {
  const counts = new Map<string, number>();
  for (const l of labels) {
    const k = (l ?? "").trim();
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}
