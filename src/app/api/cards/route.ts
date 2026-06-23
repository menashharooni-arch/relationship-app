import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan !== "pro") {
    return NextResponse.json({ error: "upgrade", message: "Multiple cards require a Pro plan." }, { status: 402 });
  }

  const { count } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= 2) {
    return NextResponse.json({ error: "limit", message: "Pro plan includes up to 3 cards total." }, { status: 402 });
  }

  const body = await req.json();
  const { username, name, title, company, phone, email, website, linkedin, instagram, twitter, tiktok, template } = body;

  if (!username) return NextResponse.json({ error: "Username required." }, { status: 400 });

  const { data, error } = await supabase
    .from("cards")
    .insert({ user_id: user.id, username, name: name || "", title: title || "", company: company || "", phone: phone || "", email: email || "", website: website || "", linkedin: linkedin || "", instagram: instagram || "", twitter: twitter || "", tiktok: tiktok || "", template: template || "classic-pro" })
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

  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ cards: cards ?? [] });
}
