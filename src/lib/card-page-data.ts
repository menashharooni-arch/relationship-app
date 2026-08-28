import { unstable_cache, revalidateTag } from "next/cache";
import { getAdminSupabase } from "@/lib/supabase-admin";

/**
 * The public card page's DATA, cached per slug.
 *
 * Why this exists: /[username] is the page every QR scan, every shared link
 * and every email signature opens — by far the highest-traffic surface — and
 * it rebuilt itself from the database on EVERY view (three round trips, plus
 * the plan-limit read). At a few hundred views that is invisible; at scale it
 * is a database query per scan for content that changes maybe twice a month.
 * Measured before this: p50 536ms, p95 2.3s at ten concurrent viewers.
 *
 * What is cached: ONLY the viewer-independent facts — the card row, its
 * owner's plan/photo/customization, the legacy profile row, and whether the
 * card is inside the owner's plan allowance. Deliberately NOT cached:
 *   • who is viewing (the getUser() call stays per-request, so owner
 *     self-view suppression still works for the right person), and
 *   • anything derived from searchParams.
 * The rendered HTML is therefore byte-identical to before; only the source of
 * these four reads changes.
 *
 * Freshness: an edit calls revalidateCardPage() and the next view is current.
 * The 60-second TTL is the backstop for the paths that change a card's
 * VISIBILITY without touching the card itself — a Stripe downgrade, an office
 * kill-switch, an account deletion — so even a write path nobody remembered to
 * tag self-heals within a minute rather than serving a stale card forever.
 */
/**
 * Rows come from `select("*")` on the untyped admin client, so they arrive as
 * `any` — exactly as they did when the page queried inline. Naming the type
 * here keeps that shape explicit rather than pretending to a precision the
 * client does not provide.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CardRecord = Record<string, any>;

export type CardPageData = {
  cardRow: CardRecord | null;
  cardOwner: { plan: string | null; photo_url: string | null; customization: unknown } | null;
  profileRow: CardRecord | null;
  withinLimit: boolean;
};

export const cardPageTag = (username: string) => `card-page:${username.toLowerCase()}`;

async function loadCardPageData(username: string): Promise<CardPageData> {
  const admin = getAdminSupabase();
  const { data: cardRow } = await admin.from("cards").select("*").eq("username", username).maybeSingle();
  const { data: cardOwner } = cardRow
    ? await admin.from("profiles").select("plan, photo_url, customization").eq("id", cardRow.user_id).maybeSingle()
    : { data: null };
  const { data: profileRow } = !cardRow
    ? await admin.from("profiles").select("*").eq("username", username).maybeSingle()
    : { data: null };

  // Same call the page made inline. Kept inside the cache so a Free account's
  // extra cards stay dark without a per-view query of their own.
  let withinLimit = true;
  if (cardRow) {
    const { cardWithinPlanLimit } = await import("@/lib/card-active");
    withinLimit = await cardWithinPlanLimit(cardRow.id as string, cardRow.user_id as string, cardOwner?.plan as string | undefined);
  }

  return {
    cardRow: (cardRow as CardRecord | null) ?? null,
    cardOwner: (cardOwner as CardPageData["cardOwner"]) ?? null,
    profileRow: (profileRow as CardRecord | null) ?? null,
    withinLimit,
  };
}

/** Cached read for one slug. Safe to call on every request. */
export function getCardPageData(username: string): Promise<CardPageData> {
  const slug = username.toLowerCase();
  return unstable_cache(() => loadCardPageData(slug), ["card-page", slug], {
    tags: [cardPageTag(slug)],
    revalidate: 60,
  })();
}

/**
 * Drop the cached copy for a slug (or several — a rename touches both the old
 * and the new one). Call from every path that edits a card, its owner's
 * profile, or the plan that governs it. Never throws: a failed invalidation
 * must not fail the write that triggered it, and the TTL still catches it.
 */
export function revalidateCardPage(...usernames: (string | null | undefined)[]): void {
  for (const u of usernames) {
    if (!u) continue;
    // { expire: 0 } — the two-argument form Next 16 requires, asking for
    // immediate expiry: an owner who edits their card and reloads the public
    // page must see the change, not a cached copy.
    try { revalidateTag(cardPageTag(u), { expire: 0 }); } catch { /* outside a request scope — TTL covers it */ }
  }
}
