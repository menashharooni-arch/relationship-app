import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

// Rough monthly price per paid plan (matches the pricing page).
const PRO_PRICE = 4.99;
const OFFICE_PRICE = 3.99;

function dayKey(t: number | string) {
  return new Date(t).toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminSupabase();
  const now = Date.now();
  const DAY = 86_400_000;
  const iso = (n: number) => new Date(now - n * DAY).toISOString();

  // ── Accounts ───────────────────────────────────────────────────────────────
  const { data: profRows } = await admin
    .from("profiles")
    .select("id, email, name, username, plan, created_at, customization, signup_source")
    .order("created_at", { ascending: false })
    .limit(1000);
  const accounts = (profRows ?? []).filter(
    (p) => !((p.customization as { _deleted?: boolean } | null)?._deleted) && p.email !== "demo@swiftcard.me"
  );

  const plans = { free: 0, pro: 0, enterprise: 0 };
  const signupSeries: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) signupSeries[dayKey(now - i * DAY)] = 0;
  let signupToday = 0, signup7 = 0, signup30 = 0;

  accounts.forEach((a) => {
    const k = a.plan === "pro" ? "pro" : a.plan === "enterprise" ? "enterprise" : "free";
    plans[k]++;
    const t = new Date(a.created_at as string).getTime();
    if (t >= now - DAY) signupToday++;
    if (t >= now - 7 * DAY) signup7++;
    if (t >= now - 30 * DAY) signup30++;
    const key = dayKey(a.created_at as string);
    if (key in signupSeries) signupSeries[key]++;
  });

  const totalAccounts = accounts.length;
  const paid = plans.pro + plans.enterprise;
  const conversion = totalAccounts ? Math.round((paid / totalAccounts) * 1000) / 10 : 0;
  const estMrr = Math.round((plans.pro * PRO_PRICE + plans.enterprise * OFFICE_PRICE) * 100) / 100;

  // ── Acquisition: where signups come from + which sources convert to paid ──
  // This is the marketing-spend view: signups, last-30-day signups, and the
  // paid-conversion rate per signup source.
  const acqMap: Record<string, { signups: number; d30: number; paid: number }> = {};
  accounts.forEach((a) => {
    const src = ((a as { signup_source?: string | null }).signup_source || "direct") as string;
    const slot = (acqMap[src] ??= { signups: 0, d30: 0, paid: 0 });
    slot.signups++;
    if (new Date(a.created_at as string).getTime() >= now - 30 * DAY) slot.d30++;
    if (a.plan === "pro" || a.plan === "enterprise") slot.paid++;
  });
  const acquisition = Object.entries(acqMap)
    .map(([source, v]) => ({ source, ...v, paidRate: v.signups ? Math.round((v.paid / v.signups) * 1000) / 10 : 0 }))
    .sort((a, b) => b.signups - a.signups);

  // ── Cards ────────────────────────────────────────────────────────────────
  const { count: cardTotal } = await admin.from("cards").select("*", { count: "exact", head: true });

  // ── Leads (contacts captured) ────────────────────────────────────────────
  const { count: leadTotal } = await admin.from("leads").select("*", { count: "exact", head: true });
  const { data: recentLeads } = await admin.from("leads").select("created_at, source").gte("created_at", iso(30)).limit(1000);
  const leadsSeries: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) leadsSeries[dayKey(now - i * DAY)] = 0;
  const bySource: Record<string, number> = {};
  let leads7 = 0, leadsToday = 0;
  (recentLeads ?? []).forEach((l) => {
    const t = new Date(l.created_at as string).getTime();
    if (t >= now - DAY) leadsToday++;
    if (t >= now - 7 * DAY) leads7++;
    const key = dayKey(l.created_at as string);
    if (key in leadsSeries) leadsSeries[key]++;
    const src = (l.source as string) || "direct";
    bySource[src] = (bySource[src] ?? 0) + 1;
  });

  // Top cards by leads (all-time, from card_owner).
  const { data: leadOwners } = await admin.from("leads").select("card_owner").limit(5000);
  const ownerCounts: Record<string, number> = {};
  (leadOwners ?? []).forEach((l) => {
    const o = (l.card_owner as string) || "";
    if (o) ownerCounts[o] = (ownerCounts[o] ?? 0) + 1;
  });
  const topCards = Object.entries(ownerCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([username, count]) => ({ username, count }));
  const activatedCards = Object.keys(ownerCounts).length; // cards that captured ≥1 lead

  // ── Views (SwiftCard vs SwiftLink) ────────────────────────────────────────
  const { count: viewTotal } = await admin.from("card_views").select("*", { count: "exact", head: true });
  const { data: recentViews } = await admin.from("card_views").select("username, created_at").gte("created_at", iso(30)).limit(5000);
  let cardViews30 = 0, linkViews30 = 0, views7 = 0;
  (recentViews ?? []).forEach((v) => {
    const t = new Date(v.created_at as string).getTime();
    if (t >= now - 7 * DAY) views7++;
    if (((v.username as string) || "").endsWith("__links")) linkViews30++; else cardViews30++;
  });

  return NextResponse.json({
    accounts: {
      total: totalAccounts,
      today: signupToday, d7: signup7, d30: signup30,
      series: Object.entries(signupSeries).map(([date, count]) => ({ date, count })),
      recent: accounts.slice(0, 10).map((a) => ({ name: a.name, email: a.email, username: a.username, plan: a.plan, created_at: a.created_at })),
    },
    plans: { free: plans.free, pro: plans.pro, office: plans.enterprise, paid, conversion, estMrr },
    acquisition,
    cards: { total: cardTotal ?? 0, perAccount: totalAccounts ? Math.round(((cardTotal ?? 0) / totalAccounts) * 10) / 10 : 0 },
    leads: {
      total: leadTotal ?? 0, today: leadsToday, d7: leads7,
      series: Object.entries(leadsSeries).map(([date, count]) => ({ date, count })),
      bySource: Object.entries(bySource).sort((a, b) => b[1] - a[1]),
      perAccount: totalAccounts ? Math.round(((leadTotal ?? 0) / totalAccounts) * 10) / 10 : 0,
    },
    views: { total: viewTotal ?? 0, d7: views7, cardViews30, linkViews30 },
    engagement: { activatedCards, activationRate: (cardTotal ?? 0) ? Math.round((activatedCards / (cardTotal ?? 1)) * 1000) / 10 : 0 },
    topCards,
  });
}
