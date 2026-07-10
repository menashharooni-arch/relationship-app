import { getAdminSupabase } from "./supabase-admin";
import { isPaidPlan } from "./plan";
import { isZapierWebhookUrl } from "./safe-fetch";

export type CrmEvent = { type: string; [k: string]: unknown };

type CrmPrefs = { notifications?: boolean; views?: boolean };

// Forward an event to the card owner's connected CRM via their Zapier webhook —
// the universal connector that routes to HubSpot, Salesforce, Pipedrive, Notion,
// Sheets, etc. Best-effort and non-blocking; gated by the owner's per-event CRM
// preferences (a Pro feature). `ownerUsername` may be a card username or the
// "<username>__links" Swift Links key.
export async function dispatchCrmEvent(ownerUsername: string | null | undefined, event: CrmEvent): Promise<void> {
  if (!ownerUsername) return;
  const base = ownerUsername.replace(/__links$/, "");
  try {
    const admin = getAdminSupabase();
    const cols = "zapier_webhook_url, customization, plan";
    // Resolve the owner CARDS-FIRST, matching every other resolver in the app
    // (card page, resolveCardSender, resolve-card, leads route). A card slug is
    // user-chosen and could collide with a DIFFERENT user's auto-generated
    // profile username — resolving profiles-first would then POST this card's
    // lead PII to the wrong user's Zapier webhook. The card row is authoritative;
    // fall back to a legacy profile username only when no card owns the slug.
    let p: { zapier_webhook_url: string | null; customization: unknown; plan: string | null } | null = null;
    const { data: card } = await admin.from("cards").select("user_id").eq("username", base).maybeSingle();
    if (card?.user_id) {
      ({ data: p } = await admin.from("profiles").select(cols).eq("id", card.user_id).maybeSingle());
    } else {
      ({ data: p } = await admin.from("profiles").select(cols).eq("username", base).maybeSingle());
    }

    // Send-time allowlist too — a URL stored before validation existed must not
    // receive lead data (SSRF defense-in-depth).
    if (!p?.zapier_webhook_url || !isPaidPlan(p.plan) || !isZapierWebhookUrl(p.zapier_webhook_url)) return;

    const prefs: CrmPrefs = ((p.customization as { crm?: CrmPrefs } | null)?.crm) ?? {};
    if (event.type.startsWith("view.") && !prefs.views) return;
    if (event.type === "conversation.notification" && !prefs.notifications) return;

    await fetch(p.zapier_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...event, card_owner: base, _ts: new Date().toISOString() }),
    });
  } catch {
    /* best-effort — never block the caller on CRM delivery */
  }
}
