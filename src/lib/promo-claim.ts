import type { SupabaseClient } from "@supabase/supabase-js";

// ── Take one use of a promo code, atomically ─────────────────────────────────
//
// uses_count used to be read, checked against max_uses, and written back as
// read+1. Twenty accounts redeeming a 5-use grant code at the same moment all
// passed the check and all wrote "1": a leaked limited code (free Pro, or an
// Office with seats, no card) could be used far past its limit (security
// audit 2026-09-24).
//
// Compare-and-set instead: the UPDATE only lands while uses_count still holds
// the value we read AND is under the cap. A lost race re-reads and tries again.
// Returns false once the code is used up — the caller must then undo the
// redemption it recorded.
export async function claimPromoUse(admin: SupabaseClient, promoId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: row } = await admin
      .from("promo_codes")
      .select("uses_count, max_uses")
      .eq("id", promoId)
      .maybeSingle();
    if (!row) return false;
    const used = Number(row.uses_count ?? 0);
    const max = row.max_uses == null ? null : Number(row.max_uses);
    if (max != null && used >= max) return false;
    // uses_count is nullable (default 0); a NULL row is matched as such.
    const q = admin.from("promo_codes").update({ uses_count: used + 1 }).eq("id", promoId);
    const { data: won } = await (row.uses_count == null ? q.is("uses_count", null) : q.eq("uses_count", used)).select("id");
    if (won && won.length > 0) return true;
  }
  return false;
}
