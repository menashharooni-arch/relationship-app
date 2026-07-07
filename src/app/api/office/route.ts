import { createClient } from "@/lib/supabase-server";
import { PLAN_LIMITS } from "@/lib/plan";
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
    .maybeSingle();

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
    .maybeSingle();
  if (existing) return NextResponse.json(existing);

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Office name required" }, { status: 400 });

  // Seats MUST be set — the invite/seat math divides by it. A Stripe purchase
  // provisions the real seat count via the webhook; a manually-created office
  // (e.g. plan granted by an admin) defaults to the minimum so invites work.
  const { data: office, error } = await supabase
    .from("offices")
    .insert({ name: name.trim(), owner_id: user.id, seats: PLAN_LIMITS.OFFICE_MIN_SEATS })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(office);
}
