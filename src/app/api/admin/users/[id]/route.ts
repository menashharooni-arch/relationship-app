import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin";
import { REFERRAL, freeMonthDays } from "@/lib/referral";

// Everything the admin needs about ONE user: identity, plan, attribution,
// every card with per-card views/leads, 30-day activity, recent leads.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const admin = getAdminSupabase();
  const { data: p } = await admin
    .from("profiles")
    .select("id, username, name, email, plan, created_at, company, title, phone, website, photo_url, signup_source, plan_expires_at, referral_code, referred_by, referral_reward_earned, customization")
    .eq("id", id)
    .maybeSingle();
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: cards } = await admin
    .from("cards")
    .select("id, username, label, name, title, company, template, created_at")
    .eq("user_id", id)
    .order("created_at", { ascending: true });

  // All slugs this user owns (profile slug covers legacy cards).
  const usernames = Array.from(new Set([p.username as string, ...(cards ?? []).map((c) => c.username as string)].filter(Boolean)));

  const now = Date.now();
  const DAY = 86_400_000;
  const since30 = new Date(now - 30 * DAY).toISOString();

  const [{ data: leads }, { data: views }, { count: referredCount }] = await Promise.all([
    usernames.length
      ? admin.from("leads").select("id, name, email, phone, source, card_owner, created_at").in("card_owner", usernames).order("created_at", { ascending: false }).limit(500)
      : Promise.resolve({ data: [] as never[] }),
    usernames.length
      ? admin.from("card_views").select("username, created_at").in("username", usernames.flatMap((u) => [u, `${u}__links`])).limit(5000)
      : Promise.resolve({ data: [] as never[] }),
    admin.from("referrals").select("*", { count: "exact", head: true }).eq("referrer_id", id),
  ]);

  // Per-card rollups + 30-day daily series.
  const leadsByCard: Record<string, number> = {};
  for (const l of leads ?? []) leadsByCard[l.card_owner as string] = (leadsByCard[l.card_owner as string] ?? 0) + 1;

  const viewsByCard: Record<string, { card: number; links: number }> = {};
  const series: Record<string, { views: number; leads: number }> = {};
  for (let i = 29; i >= 0; i--) series[new Date(now - i * DAY).toISOString().slice(0, 10)] = { views: 0, leads: 0 };
  let views30 = 0;
  for (const v of views ?? []) {
    const raw = (v.username as string) || "";
    const base = raw.replace(/__links$/, "");
    const slot = (viewsByCard[base] ??= { card: 0, links: 0 });
    if (raw.endsWith("__links")) slot.links++; else slot.card++;
    const t = new Date(v.created_at as string).getTime();
    if (t >= now - 30 * DAY) {
      views30++;
      const k = new Date(v.created_at as string).toISOString().slice(0, 10);
      if (series[k]) series[k].views++;
    }
  }
  let leads30 = 0;
  for (const l of leads ?? []) {
    const t = new Date(l.created_at as string).getTime();
    if (t >= now - 30 * DAY) {
      leads30++;
      const k = new Date(l.created_at as string).toISOString().slice(0, 10);
      if (series[k]) series[k].leads++;
    }
  }

  // referred_by is the REFERRER'S user id — resolve it to a human identity.
  let referredBy: { id: string; name: string | null; email: string | null } | null = null;
  if (p.referred_by) {
    const { data: ref } = await admin.from("profiles").select("id, name, email").eq("id", p.referred_by).maybeSingle();
    if (ref) referredBy = { id: ref.id as string, name: ref.name as string | null, email: ref.email as string | null };
  }

  const cardList = (cards ?? []).map((c) => ({
    ...c,
    leads: leadsByCard[c.username as string] ?? 0,
    cardViews: viewsByCard[c.username as string]?.card ?? 0,
    linkViews: viewsByCard[c.username as string]?.links ?? 0,
  }));
  // Legacy profile-slug card (pre-migration accounts have no cards rows).
  const hasProfileCard = !(cards ?? []).some((c) => c.username === p.username) && !!p.username;

  return NextResponse.json({
    user: {
      id: p.id, username: p.username, name: p.name, email: p.email, plan: p.plan,
      plan_expires_at: p.plan_expires_at ?? null, created_at: p.created_at,
      company: p.company, title: p.title, phone: p.phone, website: p.website, photo_url: p.photo_url,
      signup_source: p.signup_source ?? "direct", referral_code: p.referral_code ?? null,
      referred_by: referredBy, referral_reward_earned: p.referral_reward_earned ?? false,
      deleted: !!((p.customization as { _deleted?: boolean } | null)?._deleted),
    },
    cards: cardList,
    profileCard: hasProfileCard
      ? {
          username: p.username,
          leads: leadsByCard[p.username as string] ?? 0,
          cardViews: viewsByCard[p.username as string]?.card ?? 0,
          linkViews: viewsByCard[p.username as string]?.links ?? 0,
        }
      : null,
    totals: {
      leads: (leads ?? []).length,
      views: (views ?? []).length,
      leads30,
      views30,
      referred: referredCount ?? 0,
    },
    series: Object.entries(series).map(([date, v]) => ({ date, ...v })),
    recentLeads: (leads ?? []).slice(0, 12),
  });
}

// Admin actions on one user: change plan, grant a free month of Pro,
// set a custom referral code.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { plan?: string; grantFreeMonth?: boolean; referralCode?: string };

  const admin = getAdminSupabase();

  if (body.grantFreeMonth) {
    const expires = new Date(Date.now() + freeMonthDays(REFERRAL.NEW_USER_FREE_MONTHS) * 86_400_000).toISOString();
    const { error } = await admin.from("profiles").update({ plan: "pro", plan_expires_at: expires }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, plan: "pro", plan_expires_at: expires });
  }

  if (body.plan) {
    if (!["free", "pro", "enterprise"].includes(body.plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    // Explicit plan set clears any free-month expiry (it's a real plan now).
    const { error } = await admin.from("profiles").update({ plan: body.plan, plan_expires_at: null }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, plan: body.plan });
  }

  if (typeof body.referralCode === "string") {
    const code = body.referralCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
    if (code.length < 4) return NextResponse.json({ error: "Code must be at least 4 characters (A-Z, 0-9, -)" }, { status: 400 });
    // Codes must stay unique — they're how referrals attribute.
    const { data: clash } = await admin.from("profiles").select("id").eq("referral_code", code).neq("id", id).maybeSingle();
    if (clash) return NextResponse.json({ error: "That code is already taken" }, { status: 409 });
    const { error } = await admin.from("profiles").update({ referral_code: code }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, referralCode: code });
  }

  return NextResponse.json({ error: "No action" }, { status: 400 });
}
