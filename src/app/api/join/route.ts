import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const admin = getAdminSupabase();

  // Look up the invite (use admin client to bypass RLS for public invite lookup)
  const { data: member } = await admin
    .from("office_members")
    .select("*, offices(id, name, owner_id)")
    .eq("invite_token", token)
    .single();

  if (!member) return NextResponse.json({ error: "Invalid or expired invite link." }, { status: 404 });
  if (member.status === "active") return NextResponse.json({ error: "This invite has already been used." }, { status: 400 });

  // Accept: mark active, link user_id
  const { error: updateError } = await admin
    .from("office_members")
    .update({ user_id: user.id, status: "active", joined_at: new Date().toISOString() })
    .eq("id", member.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Give the joining user enterprise plan + link to office
  const officeId = (member.offices as { id: string } | null)?.id ?? member.office_id;
  await admin
    .from("profiles")
    .update({ plan: "enterprise", office_id: officeId })
    .eq("id", user.id);

  return NextResponse.json({ ok: true, officeName: (member.offices as { name: string } | null)?.name });
}
