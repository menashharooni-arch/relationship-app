import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// GET — return office + members for the calling admin
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: office } = await supabase
    .from("offices")
    .select("*, office_members(*)")
    .eq("owner_id", user.id)
    .single();

  return NextResponse.json(office ?? null);
}

// POST — create an office (idempotent: returns existing if already created)
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan !== "enterprise") {
    return NextResponse.json({ error: "Enterprise plan required" }, { status: 403 });
  }

  // Return existing office if already set up
  const { data: existing } = await supabase
    .from("offices")
    .select("*")
    .eq("owner_id", user.id)
    .single();
  if (existing) return NextResponse.json(existing);

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Office name required" }, { status: 400 });

  const { data: office, error } = await supabase
    .from("offices")
    .insert({ name: name.trim(), owner_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(office);
}
