import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS, isPaidPlan } from "@/lib/plan";
import { getOfficeBrandForUser } from "@/lib/office-brand";

const ALLOWED = ["name", "title", "company", "phone", "email", "website", "linkedin", "instagram", "twitter", "tiktok", "template", "customization", "logo_url", "label"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key];
  }

  const admin = getAdminSupabase();

  // Enforce Pro-only features on the backend (custom template + Swift Links cap).
  const { data: planRow } = await admin.from("profiles").select("plan").eq("id", user.id).single();
  if (!isPaidPlan(planRow?.plan)) {
    if (updates.template === "custom") updates.template = "classic-pro";
    const cust = updates.customization as { links?: unknown[] } | undefined;
    if (cust && Array.isArray(cust.links) && cust.links.length > PLAN_LIMITS.FREE_SWIFTLINK_BUTTONS) {
      updates.customization = { ...cust, links: cust.links.slice(0, PLAN_LIMITS.FREE_SWIFTLINK_BUTTONS) };
    }
  }

  // Office uniform branding: force brand fields so members can't override them.
  const brand = await getOfficeBrandForUser(user.id);
  if (brand) {
    if (brand.logoUrl) updates.logo_url = brand.logoUrl;
    if (brand.company) updates.company = brand.company;
    if (brand.website) updates.website = brand.website;
    if (brand.template) updates.template = brand.template;
  }

  const { error } = await admin
    .from("cards")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { error } = await admin
    .from("cards")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("cards")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ card: data });
}
