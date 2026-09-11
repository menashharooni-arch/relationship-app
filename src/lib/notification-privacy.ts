import { getAdminSupabase } from "@/lib/supabase-admin";
import { isPaidPlan } from "@/lib/plan";
import { hasMarkedPlace, redactLegacyPlace, redactPlaces, stripLocationMarks } from "@/lib/location-privacy";

// The one place a notification row is prepared for a browser.
//
// A Free account never receives the place a view came from — it is blocked out
// HERE, on the server, not hidden with CSS in the app. A blur over real text is
// a tease anyone can defeat with devtools; this is the part that actually holds.
// The app then blurs the blocks, which is what makes the redaction look
// deliberate instead of broken (see components/NotificationBody).
//
// A paid account gets the sentence exactly as it was written, with the
// invisible marks taken out.

export type NotificationRow = { body?: string | null; type?: string | null } & Record<string, unknown>;

/**
 * The notification types whose body can end in a place — the only ones the
 * legacy sweep below is allowed to touch. A lead's body ("Dana shared their
 * info with you from a QR code") has no location in it, and hunting for the
 * word "in" there would eventually eat a company name.
 */
function canCarryLocation(type: string | null | undefined): boolean {
  const t = type ?? "";
  return t === "card_viewed" || t === "contact_saved" || t.startsWith("milestone_");
}

export function redactForPlan<T extends NotificationRow>(rows: T[], paid: boolean): T[] {
  return rows.map((row) => {
    const body = typeof row.body === "string" ? row.body : null;
    if (!body) return row;
    if (paid) return { ...row, body: stripLocationMarks(body) };
    // Rows written before the marks existed say the place in plain text, and a
    // Free account would go on reading those forever.
    const marked = hasMarkedPlace(body) || !canCarryLocation(row.type)
      ? body
      : redactLegacyPlace(body);
    return { ...row, body: redactPlaces(marked) };
  });
}

/** Is this account paid? One indexed read; used by the notification endpoints. */
export async function isPaidUser(userId: string): Promise<boolean> {
  try {
    const { data } = await getAdminSupabase()
      .from("profiles").select("plan").eq("id", userId).maybeSingle();
    return isPaidPlan(data?.plan as string | null);
  } catch {
    // Unknown plan: assume FREE. Withholding a place name from a paying
    // customer for one poll is recoverable; handing it to a Free account is the
    // leak this exists to close.
    return false;
  }
}
