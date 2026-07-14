import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { requireOfficeCapability } from "@/lib/office-roles";
import { listOfficeCards } from "@/lib/office-cards";

// GET /api/office/cards — every card in the caller's office (owner + active
// members), for the /office/admin card manager.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Server-side authorization — never trust the UI. Returns the office context.
  const ctx = await requireOfficeCapability(user.id, "manage_member_cards");
  if (!ctx) return NextResponse.json({ error: "You don't have permission to manage team cards." }, { status: 403 });

  const cards = await listOfficeCards(ctx.officeId);
  return NextResponse.json({ cards });
}
