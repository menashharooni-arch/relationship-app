import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin";

// Full user directory for the admin Users page: identity, plan (+expiry),
// signup source, cards owned (count), leads, views.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = getAdminSupabase();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, name, email, plan, created_at, company, title, customization, signup_source, plan_expires_at, referral_code")
    .order("created_at", { ascending: false });

  if (!profiles) return NextResponse.json({ users: [] });

  const [{ data: cardRows }, { data: leadRows }, { data: viewRows }] = await Promise.all([
    admin.from("cards").select("user_id, username"),
    admin.from("leads").select("card_owner"),
    admin.from("card_views").select("username"),
  ]);

  // Cards per account (+ their usernames, so leads/views can roll up per user).
  const cardsByUser: Record<string, string[]> = {};
  for (const c of cardRows ?? []) {
    (cardsByUser[c.user_id as string] ??= []).push(c.username as string);
  }

  const leadsByUsername: Record<string, number> = {};
  for (const l of leadRows ?? []) {
    const o = (l.card_owner as string) || "";
    if (o) leadsByUsername[o] = (leadsByUsername[o] ?? 0) + 1;
  }

  // card_views usernames: "<username>" for cards, "<username>__links" for Swift Links.
  const viewsByUsername: Record<string, number> = {};
  for (const v of viewRows ?? []) {
    const u = ((v.username as string) || "").replace(/__links$/, "");
    if (u) viewsByUsername[u] = (viewsByUsername[u] ?? 0) + 1;
  }

  const users = profiles
    .filter((p) => !((p.customization as { _deleted?: boolean } | null)?._deleted))
    .map((p) => {
      // A user's usernames = their profile slug + all their cards' slugs.
      const usernames = new Set<string>([p.username as string, ...(cardsByUser[p.id as string] ?? [])].filter(Boolean));
      let lead_count = 0, view_count = 0;
      for (const u of usernames) {
        lead_count += leadsByUsername[u] ?? 0;
        view_count += viewsByUsername[u] ?? 0;
      }
      return {
        id: p.id,
        username: p.username,
        name: p.name,
        email: p.email,
        plan: p.plan,
        plan_expires_at: p.plan_expires_at ?? null,
        signup_source: p.signup_source ?? null,
        referral_code: p.referral_code ?? null,
        company: p.company,
        title: p.title,
        created_at: p.created_at,
        card_count: (cardsByUser[p.id as string] ?? []).length,
        lead_count,
        view_count,
      };
    });

  return NextResponse.json({ users });
}
