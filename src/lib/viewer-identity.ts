import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";

// ── Who is REALLY viewing a card ─────────────────────────────────────────────
//
// THE BUG THIS EXISTS FOR. A card owner was told "Pyramid viewed your card"
// when the person looking at it was Mina. The view event's identity fields
// (visitor_name/email/phone) were taken from the CLIENT — which reads them out
// of a device-global localStorage blob ("swiftcard_visitor") written the last
// time ANYONE filled a share form in that browser. The blob survives logout,
// login, and account switches, so on any shared or multi-account device the
// previous person's identity gets stamped onto the next person's views.
//
// The rule now: WHEN THE REQUEST CARRIES AN AUTHENTICATED SESSION, THE SERVER
// DERIVES THE VIEWER'S IDENTITY FROM THAT SESSION AND THE CLIENT-SUPPLIED
// IDENTITY IS IGNORED. The session is the one identity signal that cannot be
// stale (cookies rotate on account switch) or forged (Supabase-signed).
//
// Anonymous requests keep the client-supplied fields: a visitor who shared
// their details once being recognized on later views is an intended feature
// (see CardEventTracker), and with no session there is nothing more
// authoritative to prefer.

export type SessionViewer = {
  userId: string;
  name: string | null;
  email: string | null;
};

export type EventIdentity = {
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
};

/**
 * The identity to record on a card event — the pure decision, testable
 * without a database.
 *
 * Authenticated viewer → their session identity, whole. The phone is set to
 * null rather than kept: a session has no phone number, and the cached one may
 * belong to a different person — recording Mina's name next to Pyramid's phone
 * would cross-link the two people in the owner's contact matching (the events
 * GET matches conversations by phone as well as email).
 *
 * A session with no resolvable display name still overrides: the notification
 * then honestly says "Someone viewed your card" instead of confidently naming
 * the wrong person. Never "fall back" to the client blob for an authenticated
 * viewer — a stale name is worse than no name.
 */
export function authoritativeEventIdentity(
  viewer: SessionViewer | null,
  clientSupplied: EventIdentity,
): EventIdentity {
  if (!viewer) return clientSupplied;
  return {
    visitor_name: viewer.name,
    visitor_email: viewer.email,
    visitor_phone: null,
  };
}

type Admin = ReturnType<typeof getAdminSupabase>;

/**
 * Resolve the authenticated viewer on the current request, or null when the
 * request is anonymous. Display name comes from their oldest card (the name
 * this person publicly presents as), then the OAuth profile name; email is the
 * AUTH email — profiles.email drifts to a card's public contact address (see
 * account-email.ts) and is deliberately not used.
 *
 * Never throws: an auth/lookup failure is treated as anonymous, so recording
 * a view can never break a visitor's page load.
 */
export async function resolveSessionViewer(admin: Admin): Promise<SessionViewer | null> {
  try {
    const { data: { user } } = await (await createClient()).auth.getUser();
    if (!user) return null;

    let cardName: string | null = null;
    try {
      const { data: card } = await admin
        .from("cards")
        .select("name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      cardName = (card?.name as string | null) ?? null;
    } catch {
      /* card lookup failing must not degrade the viewer to anonymous */
    }

    const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
    const name = (cardName || meta.full_name || meta.name || "").trim() || null;
    return { userId: user.id, name, email: user.email ?? null };
  } catch {
    return null;
  }
}
