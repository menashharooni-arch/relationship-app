import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin";

// GET /api/admin/promo-codes/log — the full promo history for the admin's
// log popup: EVERY code ever created (active and deactivated), with what the
// offer was, when it was created/deactivated, usage, and the email sends we
// made for it (from email_logs rows tagged "promo:CODE" by the send route).

export type PromoLogEntry = {
  id: string;
  code: string;
  description: string | null;
  discount_type: string | null;
  discount_percent: number | null;
  discount_amount: number | null;
  free_days: number | null;
  plan_target: string | null;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  created_at: string;
  deactivated_at: string | null;
  active: boolean;
  stripe_coupon_id: string | null;
  sends: { count: number; first: string | null; last: string | null };
};

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = getAdminSupabase();

  const [{ data: codes, error: codesErr }, { data: sendRows }] = await Promise.all([
    admin.from("promo_codes").select("*").order("created_at", { ascending: false }),
    // "promo" (legacy, untagged) + "promo:CODE" (tagged). email_logs is small
    // and append-only; two columns keep this cheap.
    admin.from("email_logs").select("type, created_at").like("type", "promo%").order("created_at", { ascending: true }),
  ]);

  if (codesErr) return NextResponse.json({ error: codesErr.message }, { status: 500 });

  // Aggregate sends per code string.
  const byCode = new Map<string, { count: number; first: string | null; last: string | null }>();
  let untagged = 0;
  for (const row of sendRows ?? []) {
    const t = row.type as string;
    if (t === "promo") { untagged++; continue; }
    const code = t.slice("promo:".length);
    const agg = byCode.get(code) ?? { count: 0, first: null, last: null };
    agg.count++;
    if (!agg.first) agg.first = row.created_at as string;
    agg.last = row.created_at as string;
    byCode.set(code, agg);
  }

  const entries: PromoLogEntry[] = (codes ?? []).map((c) => ({
    id: c.id as string,
    code: c.code as string,
    description: (c.description as string) ?? null,
    discount_type: (c.discount_type as string) ?? null,
    discount_percent: (c.discount_percent as number) ?? null,
    discount_amount: (c.discount_amount as number) ?? null,
    free_days: (c.free_days as number) ?? null,
    plan_target: (c.plan_target as string) ?? null,
    max_uses: (c.max_uses as number) ?? null,
    uses_count: (c.uses_count as number) ?? 0,
    expires_at: (c.expires_at as string) ?? null,
    created_at: c.created_at as string,
    // Column may not exist before promo-deactivated-at.sql — reads as undefined.
    deactivated_at: (c.deactivated_at as string | undefined) ?? null,
    active: (c.active as boolean) ?? true,
    stripe_coupon_id: (c.stripe_coupon_id as string) ?? null,
    sends: byCode.get(c.code as string) ?? { count: 0, first: null, last: null },
  }));

  return NextResponse.json({ codes: entries, untaggedSends: untagged });
}
