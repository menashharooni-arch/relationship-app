import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS } from "@/lib/plan";
import { NextResponse } from "next/server";

const OFFICE_MIN_SEATS = PLAN_LIMITS.OFFICE_MIN_SEATS;

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

  const officeId = (member.offices as { id: string } | null)?.id ?? member.office_id;

  // HARD seat guard at accept time. The invite-send check only counts ACTIVE
  // members, so an admin could send more pending invites than seats; without
  // this, all of them accepting would overflow the seat count. This is the
  // real guarantee that active members never exceed the paid seats.
  const { data: officeRow } = await admin.from("offices").select("seats").eq("id", officeId).maybeSingle();
  const seatCap = (officeRow?.seats as number | null) ?? OFFICE_MIN_SEATS;
  const { count: activeCount } = await admin
    .from("office_members")
    .select("*", { count: "exact", head: true })
    .eq("office_id", officeId)
    .eq("status", "active");
  if ((activeCount ?? 0) >= seatCap) {
    return NextResponse.json(
      { error: "This team's seats are all full. Ask the team admin to free up or add a seat." },
      { status: 409 }
    );
  }

  // Accept: mark active, link user_id
  const { error: updateError } = await admin
    .from("office_members")
    .update({ user_id: user.id, status: "active", joined_at: new Date().toISOString() })
    .eq("id", member.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Give the joining user enterprise plan + link to office
  await admin
    .from("profiles")
    .update({ plan: "enterprise", office_id: officeId })
    .eq("id", user.id);

  return NextResponse.json({ ok: true, officeName: (member.offices as { name: string } | null)?.name });
}
