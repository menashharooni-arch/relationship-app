import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// DELETE ?id=<member_id> — remove a member from the office
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("id");
  if (!memberId) return NextResponse.json({ error: "Member ID required" }, { status: 400 });

  // Verify the member belongs to this admin's office
  const { data: office } = await supabase
    .from("offices")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!office) return NextResponse.json({ error: "No office found" }, { status: 404 });

  // Revert member's plan to free and clear office_id
  const { data: member } = await supabase
    .from("office_members")
    .select("user_id")
    .eq("id", memberId)
    .eq("office_id", office.id)
    .single();

  if (member?.user_id) {
    await supabase
      .from("profiles")
      .update({ plan: "free", office_id: null })
      .eq("id", member.user_id);
  }

  const { error } = await supabase
    .from("office_members")
    .delete()
    .eq("id", memberId)
    .eq("office_id", office.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
