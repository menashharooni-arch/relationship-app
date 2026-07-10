import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";

// ── Owner self-traffic exclusion (shared across every analytics ingest) ──────
// A card owner poking at their own card/SwiftLink/preview must NEVER count as a
// visitor. Every public ingest endpoint (views, card-events, analytics/event)
// runs the SAME server-side check so there is no bypass. Client suppression
// (localStorage / a `self` flag / a client-supplied user or card id) is a UX
// nicety only — it is NEVER trusted for the exclusion decision.
//
// CRITICAL: exclusion is IDENTITY/OWNERSHIP-based, not IP-based. A legitimate
// external visitor who happens to share the owner's IP (office NAT, shared
// device while signed out, phone on the same Wi-Fi) MUST still count. Only the
// authenticated session that OWNS the exact slug is excluded — a team member or
// office admin viewing a colleague's card is a real visitor and is counted.

// A SwiftLink surface is tracked under "<slug>__links"; strip that suffix so the
// owner lookup resolves back to the underlying card. Plain card slugs are
// unaffected (they never contain "__links").
export function baseSlugForOwnerLookup(username: string): string {
  return username.replace(/__links$/, "");
}

// Pure ownership decision — the testable core of the exclusion. True only when a
// real viewer id matches a real owner id. Missing/empty ids never match (so a
// signed-out visitor, or a slug with no resolvable owner, is always counted),
// and it can never collapse two different users into a "self".
export function isSelfTraffic(
  ownerId: string | null | undefined,
  viewerId: string | null | undefined,
): boolean {
  return !!ownerId && !!viewerId && ownerId === viewerId;
}

type Admin = ReturnType<typeof getAdminSupabase>;

// Resolve the user id that owns a slug: the cards table first (multi-card
// accounts), then the legacy profile username as a fallback. Returns null for a
// slug nobody owns.
export async function resolveOwnerId(admin: Admin, slug: string): Promise<string | null> {
  const base = baseSlugForOwnerLookup(slug);
  const { data: card } = await admin
    .from("cards")
    .select("user_id")
    .eq("username", base)
    .maybeSingle();
  if (card?.user_id) return card.user_id as string;
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("username", base)
    .maybeSingle();
  return (profile?.id as string | undefined) ?? null;
}

// Full server-side check: is the CURRENT request coming from the slug's owner?
// Safe to call unconditionally — with no session (signed-out visitor, cron,
// bot, automated preview) it returns false and the event is recorded normally.
export async function isOwnerRequest(admin: Admin, slug: string): Promise<boolean> {
  try {
    const { data: { user: viewer } } = await (await createClient()).auth.getUser();
    if (!viewer) return false;
    const ownerId = await resolveOwnerId(admin, slug);
    return isSelfTraffic(ownerId, viewer.id);
  } catch {
    // No session context available (e.g. invoked outside a request) — treat as a
    // visitor; never let an auth lookup failure drop a legitimate event.
    return false;
  }
}
