import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeCardScope, type CardScope } from "@/lib/crm-scope";

// Server-side half of the scope vocabulary: parsing the choice a client sends
// at CONNECT time and pinning it to cards the caller actually owns. The pure
// rules stay in crm-scope.ts; this file exists because ownership needs the DB.

/**
 * Parse the `cards` value a connect/save flow sends before a connection
 * exists. "all" (or absence) means all cards; a comma-separated uuid list
 * means only those. Returns undefined for junk so the caller can refuse
 * loudly instead of storing a scope the user didn't pick.
 */
export function parseCardsParam(raw: string | null | undefined): CardScope | undefined {
  if (raw === null || raw === undefined || raw === "" || raw === "all") return null;
  const scope = sanitizeCardScope(raw.split(","));
  if (!scope || scope.length === 0) return undefined;
  return scope;
}

/**
 * True when every id in `scope` belongs to `userId`. A foreign id would never
 * match at send time (fail closed), but it would be a scope the owner can't
 * see or reason about in their own UI — reject it up front instead.
 */
export async function scopeIsOwned(admin: SupabaseClient, userId: string, scope: CardScope): Promise<boolean> {
  if (scope === null || scope.length === 0) return true;
  const { data: owned } = await admin.from("cards").select("id").eq("user_id", userId).in("id", scope);
  const ownedIds = new Set((owned ?? []).map((c) => c.id as string));
  return scope.every((id) => ownedIds.has(id));
}
