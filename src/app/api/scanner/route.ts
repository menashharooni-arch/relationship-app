import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { aiVision, hasAiProvider } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const adminSupabase = getAdminSupabase();
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan !== "pro" && profile?.plan !== "enterprise") {
    return NextResponse.json({ error: "pro_required" }, { status: 403 });
  }

  const body = await request.json();
  const { imageBase64, mediaType = "image/jpeg" } = body as { imageBase64?: string; mediaType?: string };
  if (!imageBase64) return NextResponse.json({ error: "no_image" }, { status: 400 });
  if (!hasAiProvider()) return NextResponse.json({ error: "no_ai" }, { status: 503 });

  const text = (await aiVision({
    imageBase64,
    mediaType,
    maxTokens: 256,
    json: true,
    prompt: 'Extract contact information from this business card. Return ONLY valid JSON with these exact fields (omit any field you cannot confidently read): {"name":"","title":"","company":"","phone":"","email":"","website":""}',
  })) ?? "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({});

  try {
    const extracted = JSON.parse(jsonMatch[0]);
    return NextResponse.json(extracted);
  } catch {
    return NextResponse.json({});
  }
}
