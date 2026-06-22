import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const supabase = getSupabase();
  await supabase.from("card_views").insert({ username });
  return NextResponse.json({ ok: true });
}
