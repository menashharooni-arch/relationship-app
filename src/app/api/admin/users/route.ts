import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminSupabase();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, name, email, plan, created_at, company, title")
    .order("created_at", { ascending: false });

  if (!profiles) return NextResponse.json({ users: [] });

  const { data: leadCounts } = await admin
    .from("leads")
    .select("card_owner");

  const countByOwner: Record<string, number> = {};
  for (const l of leadCounts ?? []) {
    countByOwner[l.card_owner] = (countByOwner[l.card_owner] ?? 0) + 1;
  }

  const { data: viewCounts } = await admin
    .from("card_views")
    .select("username");

  const viewsByOwner: Record<string, number> = {};
  for (const v of viewCounts ?? []) {
    viewsByOwner[v.username] = (viewsByOwner[v.username] ?? 0) + 1;
  }

  const users = profiles.map((p) => ({
    ...p,
    lead_count: countByOwner[p.username] ?? 0,
    view_count: viewsByOwner[p.username] ?? 0,
  }));

  return NextResponse.json({ users });
}
