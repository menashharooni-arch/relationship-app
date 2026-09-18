import { getAdminSupabase } from "./supabase-admin";
import { resolveZapierTarget, CRM_WEBHOOK_TIMEOUT_MS } from "./crm-sync";

export type CrmEvent = { type: string; [k: string]: unknown };

// Re-exported: callers and tests have always imported the bound from here.
export { CRM_WEBHOOK_TIMEOUT_MS };

// Forward an event to the card owner's connected CRM via their Zapier webhook —
// the universal connector that routes to HubSpot, Salesforce, Pipedrive, Notion,
// Sheets, etc. Best-effort and non-blocking; gated by the per-event CRM
// preferences of whoever owns the webhook (a Pro feature). `ownerUsername` may
// be a card username or the "<username>__links" Swift Links key.
//
// Plan gate, Zapier-host allowlist, per-card scope (zapier_card_ids +
// isCardInScope) and the Office inheritance all live in resolveZapierTarget —
// the same resolver lead capture uses, so a view and a lead from one card can
// never go to two different places.
export async function dispatchCrmEvent(ownerUsername: string | null | undefined, event: CrmEvent): Promise<void> {
  if (!ownerUsername) return;
  const base = ownerUsername.replace(/__links$/, "");
  try {
    const admin = getAdminSupabase();
    // Resolve the owner CARDS-FIRST, matching every other resolver in the app
    // (card page, resolveCardSender, resolve-card, leads route). A card slug is
    // user-chosen and could collide with a DIFFERENT user's auto-generated
    // profile username — resolving profiles-first would then POST this card's
    // lead PII to the wrong user's Zapier webhook. The card row is authoritative;
    // fall back to a legacy profile username only when no card owns the slug.
    // `id` alongside user_id: the card id is what per-card scoping is keyed on
    // (usernames are renameable, ids aren't).
    const { data: card } = await admin.from("cards").select("id, user_id").eq("username", base).maybeSingle();
    let userId = (card?.user_id as string | undefined) ?? null;
    if (!userId) {
      const { data: p } = await admin.from("profiles").select("id").eq("username", base).maybeSingle();
      userId = (p?.id as string | undefined) ?? null;
    }
    if (!userId) return;

    // The legacy profile-username branch has no card row at all — no id, so
    // once a scope is set it is out of it (fail closed, same rule everywhere).
    const target = await resolveZapierTarget(userId, (card?.id as string | undefined) ?? null);
    if (!target) return;

    if (event.type.startsWith("view.") && !target.prefs.views) return;
    if (event.type === "conversation.notification" && !target.prefs.notifications) return;

    // Bounded. This is awaited INSIDE the view pipeline — after the card_views
    // row is written and before the milestone check and the owner's
    // notification. The catch below swallows an error, but an error was never
    // the risk: a webhook that simply never answers held the request open
    // until the platform killed it, and everything after this line — the
    // milestone, the card_events row, the push — silently never ran. The bar
    // existed; the bell didn't. A Zap either answers in well under this or
    // is not going to.
    await fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...event, card_owner: base, _ts: new Date().toISOString() }),
      signal: AbortSignal.timeout(CRM_WEBHOOK_TIMEOUT_MS),
    });
  } catch {
    /* best-effort — never block the caller on CRM delivery */
  }
}
