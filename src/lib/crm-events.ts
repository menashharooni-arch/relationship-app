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
    // Common case (primary card / legacy): the username IS a profile username —
    // a single query. Only fall back to a card lookup for secondary cards.
    let { data: p } = await admin.from("profiles").select(cols).eq("username", base).maybeSingle();
    if (!p) {
      const { data: card } = await admin.from("cards").select("user_id").eq("username", base).maybeSingle();
      if (card?.user_id) {
        ({ data: p } = await admin.from("profiles").select(cols).eq("id", card.user_id).maybeSingle());
      }
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
