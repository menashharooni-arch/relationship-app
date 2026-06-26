import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS, isPaidPlan } from "@/lib/plan";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();

  const { data: profile } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const paid = isPaidPlan(profile?.plan);

  const { count } = await admin
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Free is capped at FREE_CARD_LIMIT cards. Existing cards are never deleted —
  // we only block creating new ones beyond the cap.
  if (!paid && (count ?? 0) >= PLAN_LIMITS.FREE_CARD_LIMIT) {
    return NextResponse.json(
      {
        error: "limit",
        message: `Free includes ${PLAN_LIMITS.FREE_CARD_LIMIT} card. Upgrade to Pro for unlimited cards.`,
        upgrade: "/pricing",
      },
      { status: 402 }
    );
  }

  const body = await req.json();
  const { username, name, title, company, phone, email, website, linkedin, instagram, twitter, tiktok, template, customization, logo_url, label } = body;

  if (!username) return NextResponse.json({ error: "Username required." }, { status: 400 });

  // Cap Swift Links buttons on Free (backend-enforced, not just UI).
  let cust = (customization ?? {}) as Record<string, unknown>;
  if (!paid && Array.isArray(cust.links) && cust.links.length > PLAN_LIMITS.FREE_SWIFTLINK_BUTTONS) {
    cust = { ...cust, links: (cust.links as unknown[]).slice(0, PLAN_LIMITS.FREE_SWIFTLINK_BUTTONS) };
  }
  // Custom designer is Pro-only — Free can't save a "custom" template.
  const safeTemplate = !paid && template === "custom" ? "classic-pro" : (template || "classic-pro");

  const { data, error } = await admin
    .from("cards")
    .insert({
      user_id: user.id,
      username,
      name: name || "",
      title: title || "",
      company: company || "",
      phone: phone || "",
      email: email || "",
      website: website || "",
      linkedin: linkedin || "",
      instagram: instagram || "",
      twitter: twitter || "",
      tiktok: tiktok || "",
      template: safeTemplate,
      customization: cust,
      logo_url: logo_url || null,
      label: label || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ card: data });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: cards } = await admin
    .from("cards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ cards: cards ?? [] });
}
