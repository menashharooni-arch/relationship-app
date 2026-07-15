import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { aiVision, hasAiProvider } from "@/lib/ai";
import { isPaidPlan } from "@/lib/plan";

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

  // The AI card scanner is a Pro feature — no free allowance (owner decision,
  // Jul 2026; it previously gave Free 3 scans/month). 403 rather than 402: this
  // isn't a meter that refills on the 1st, it's simply not on the Free plan.
  if (!isPaidPlan(profile?.plan)) {
    return NextResponse.json(
      { code: "SCANNER_PRO_ONLY", error: "upgrade", message: "Scanning business cards is a Pro feature. Upgrade to scan unlimited cards.", upgrade: "/pricing" },
      { status: 403 }
    );
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
    // Pro-only, and Pro is unlimited — nothing to meter or report.
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch {
    return NextResponse.json({});
  }
}
