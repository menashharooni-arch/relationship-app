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
 * Authenticated viewer → their session NAME, and nothing else. The phone is
 * set to null rather than kept: a session has no phone number, and the cached
 * one may belong to a different person — recording Mina's name next to
 * Pyramid's phone would cross-link the two people in the owner's contact
 * matching (the events GET matches conversations by phone as well as email).
 *
 * The AUTH EMAIL is deliberately NOT recorded either. It briefly was, which
 * meant any signed-in SwiftCard user merely OPENING a stranger's card handed
 * that stranger their account email (visible in the contact timeline and
 * POSTed to the owner's Zapier webhook) — an identity disclosure the viewer
 * never consented to. An email enters an event only when the visitor
 * explicitly typed it into a share form. The cost is that a signed-in
 * viewer's views join conversations by visitor_id alone; that is the right
 * trade.
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
    visitor_email: null,
    visitor_phone: null,
  };
}

type Admin = ReturnType<typeof getAdminSupabase>;

/**
 * Contact details safe to write into the owner's CRM, or null.
 *
 * /api/card-events is public and card slugs are public, so for an anonymous
 * visitor the name/email/phone on an event arrive FROM THE CLIENT. That is
 * deliberate — it is how someone who shared their details once is recognised
 * on a later visit — and it is fine for our own bell, which records how sure
 * we are (`identityLevel`) and never presents an association as certain.
 *
 * It is not fine for a CRM. Salesforce, HubSpot and a Zapier pipeline are a
 * customer's system of record, and anyone could POST any public slug with any
 * name and email and have a fabricated contact land in it.
 *
 * So this re-derives the details SERVER-SIDE instead of trusting the payload:
 *   • an authenticated viewer is already authoritative — their session decided
 *     the name, and by design it carries no email or phone;
 *   • an anonymous visitor only counts if they actually submitted a lead to
 *     THIS owner from THIS browser, and then the LEAD's own stored values are
 *     used, never the ones the request supplied.
 * Anything else returns null, and the event goes to the CRM without contact
 * details — honest, and still carrying the event, source and location.
 *
 * Never throws: a lookup failure degrades to null (no contact details) rather
 * than breaking event recording for a visitor.
 */
export async function corroboratedContact(opts: {
  admin: Admin;
  cardOwner: string;
  visitorId: string | null | undefined;
  sessionViewer: SessionViewer | null;
  identity: EventIdentity;
}): Promise<{ name: string | null; email: string | null; phone: string | null } | null> {
  const { admin, cardOwner, visitorId, sessionViewer, identity } = opts;

  // A session is proof of who this is. authoritativeEventIdentity has already
  // reduced it to the display name with no email or phone, which is the whole
  // point of that function — pass it straight through.
  if (sessionViewer) {
    return identity.visitor_name ? { name: identity.visitor_name, email: null, phone: null } : null;
  }

  if (!visitorId) return null;

  try {
    // Matched on visitor_id, not on the supplied email: the email is exactly
    // the field an attacker controls, so using it to look up the record that
    // is supposed to vouch for it would prove nothing.
    const { data } = await admin
      .from("leads")
      .select("name, email, phone")
      .eq("card_owner", cardOwner)
      .eq("visitor_id", visitorId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const name = (data.name as string | null) || null;
    const email = (data.email as string | null) || null;
    const phone = (data.phone as string | null) || null;
    return name || email || phone ? { name, email, phone } : null;
  } catch {
    return null;
  }
}

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
