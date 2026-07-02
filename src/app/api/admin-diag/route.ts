import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// TEMPORARY diagnostic endpoint — verifies every query the admin console runs
// against the real database, so the admin pages are guaranteed error-free.
// Token-guarded; REMOVED immediately after verification.
const TOKEN = "dg7Kq2vXp9RmT4wZbN6cY3sHfJ8aLeU5";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const admin = getAdminSupabase();
  const results: Record<string, { ok: boolean; error?: string; rows?: number }> = {};

  async function check(name: string, fn: () => PromiseLike<{ error: { message: string } | null; count?: number | null; data?: unknown[] | null }>) {
    try {
      const { error, data, count } = await fn();
      results[name] = error
        ? { ok: false, error: error.message }
        : { ok: true, rows: count ?? (Array.isArray(data) ? data.length : undefined) };
    } catch (e) {
      results[name] = { ok: false, error: String(e) };
    }
  }

  // 1. Users directory query (exact columns the /admin/users API selects)
  await check("users_list", () =>
    admin.from("profiles").select("id, username, name, email, plan, created_at, company, title, customization, signup_source, plan_expires_at, referral_code").limit(3)
  );

  // 2. Rollup sources
  await check("cards", () => admin.from("cards").select("user_id, username").limit(3));
  await check("leads", () => admin.from("leads").select("card_owner").limit(3));
  await check("card_views", () => admin.from("card_views").select("username").limit(3));

  // 3. User detail query (exact columns /admin/users/[id] selects)
  await check("user_detail_profile", () =>
    admin.from("profiles").select("id, username, name, email, plan, created_at, company, title, phone, website, photo_url, signup_source, plan_expires_at, referral_code, referred_by, referral_reward_earned, customization").limit(1)
  );
  await check("user_detail_cards", () =>
    admin.from("cards").select("id, username, label, name, title, company, template, created_at").limit(1)
  );
  await check("user_detail_leads", () =>
    admin.from("leads").select("id, name, email, phone, source, card_owner, created_at").limit(1)
  );
  await check("referrals_count", () =>
    admin.from("referrals").select("*", { count: "exact", head: true })
  );

  // 4. Referrals page queries
  await check("referrals_stats", () =>
    admin.from("referrals").select("status, reward_granted, flagged_reason, code, referred_id, created_at").limit(3)
  );
  await check("profiles_referral_fields", () =>
    admin.from("profiles").select("signup_source, referral_reward_earned, plan_expires_at").limit(3)
  );

  // 5. Marketing page: email + promo tables
  await check("email_preferences", () =>
    admin.from("email_preferences").select("user_id, marketing_emails, unsubscribe_token").limit(1)
  );
  await check("email_logs", () => admin.from("email_logs").select("id").limit(1));
  await check("promo_codes", () =>
    admin.from("promo_codes").select("id, code, description, discount_percent, discount_amount, discount_type, max_uses, expires_at, plan_target, created_at").limit(3)
  );

  // 6. Analytics page: counts
  await check("analytics_profiles", () =>
    admin.from("profiles").select("id, email, name, username, plan, created_at, customization, signup_source").limit(3)
  );
  await check("analytics_cards_count", () => admin.from("cards").select("*", { count: "exact", head: true }));
  await check("analytics_leads_count", () => admin.from("leads").select("*", { count: "exact", head: true }));
  await check("analytics_views_count", () => admin.from("card_views").select("*", { count: "exact", head: true }));

  const failures = Object.entries(results).filter(([, r]) => !r.ok);
  return NextResponse.json({ allOk: failures.length === 0, failures: failures.map(([k]) => k), results });
}
