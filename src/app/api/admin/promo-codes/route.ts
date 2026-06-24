import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

async function requireAdmin(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) return null;
  return user;
}

// POST /api/admin/promo-codes — create a new promo code
export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    code,
    description,
    discount_percent,
    discount_type = "percent",
    discount_amount,
    max_uses,
    expires_at,
    plan_target = "free",
    stripe_coupon_id,
  } = body;

  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });
  if (!discount_percent && !discount_amount) {
    return NextResponse.json({ error: "discount_percent or discount_amount required" }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin.from("promo_codes").insert({
    code: code.toUpperCase().trim(),
    description,
    discount_percent,
    discount_type,
    discount_amount,
    max_uses,
    expires_at: expires_at || null,
    plan_target,
    stripe_coupon_id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promo: data });
}

// GET /api/admin/promo-codes — list all promo codes
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codes: data });
}

// DELETE /api/admin/promo-codes?id=<id> — delete a promo code
export async function DELETE(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = getAdminSupabase();
  const { error } = await admin.from("promo_codes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
