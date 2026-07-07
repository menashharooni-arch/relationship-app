import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS, isPaidPlan, sanitizeCustomizationForPlan } from "@/lib/plan";
import { getOfficeBrandForUser } from "@/lib/office-brand";
import { seedDemoContact } from "@/lib/demo-contact";

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
        message: "Ready for a second card? Go unlimited with Pro.",
        upgrade: "/pricing",
      },
      { status: 402 }
    );
  }

  const body = await req.json();
  const { username, name, title, company, phone, email, website, linkedin, instagram, twitter, tiktok, template, customization, logo_url, label } = body;

  if (!username) return NextResponse.json({ error: "Username required." }, { status: 400 });

  // Enforce Free limits on the customization blob (Pro-only accent/font stripped,
  // link buttons capped) — backend-enforced, not just hidden in the UI.
  let cust = sanitizeCustomizationForPlan((customization ?? {}) as Record<string, unknown>, paid);
  // Custom designer is Pro-only — Free can't save a "custom" template.
  let safeTemplate = !paid && template === "custom" ? "classic-pro" : (template || "classic-pro");

  // Office uniform branding: if the user is under an office with a brand,
  // force the logo, company, website and design — individuals keep only their
  // personal details (name/title/phone/email).
  let finalCompany = company || "";
  let finalWebsite = website || "";
  let finalLogo = logo_url || null;
  const brand = await getOfficeBrandForUser(user.id);
  if (brand) {
    if (brand.logoUrl) finalLogo = brand.logoUrl;
    if (brand.company) finalCompany = brand.company;
    if (brand.website) finalWebsite = brand.website;
    if (brand.template) safeTemplate = brand.template;
    if (brand.template === "custom" && brand.customLayout) cust = { ...cust, customLayout: brand.customLayout };
  }

  const { data, error } = await admin
    .from("cards")
    .insert({
      user_id: user.id,
      username,
      name: name || "",
      title: title || "",
      company: finalCompany,
      phone: phone || "",
      email: email || "",
      website: finalWebsite,
      linkedin: linkedin || "",
      instagram: instagram || "",
      twitter: twitter || "",
      tiktok: tiktok || "",
      template: safeTemplate,
      customization: cust,
      logo_url: finalLogo,
      label: label || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // First card on the account → seed a sample contact so the dashboard/contacts
  // aren't empty and the guided tour has a real contact to demonstrate.
  if ((count ?? 0) === 0) {
    await seedDemoContact(username);
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
