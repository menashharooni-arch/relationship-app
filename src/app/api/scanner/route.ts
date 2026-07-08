import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { aiVision, hasAiProvider } from "@/lib/ai";
import { PLAN_LIMITS, isPaidPlan } from "@/lib/plan";
import { readUsage, bumpUsage } from "@/lib/usage";

export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const adminSupabase = getAdminSupabase();
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("plan, customization")
    .eq("id", user.id)
    .single();

  // Free gets a monthly taste of the scanner (resets on the 1st); Pro/Office unlimited.
  const paid = isPaidPlan(profile?.plan);
  if (!paid && readUsage(profile?.customization).scans >= PLAN_LIMITS.FREE_SCANS_PER_MONTH) {
    return NextResponse.json(
      { error: "upgrade", message: `You've used your ${PLAN_LIMITS.FREE_SCANS_PER_MONTH} free card scans this month. Upgrade to Pro for unlimited scanning.`, upgrade: "/pricing" },
      { status: 402 }
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
    const extracted = JSON.parse(jsonMatch[0]);
    // Count a successful scan against the free monthly allowance.
    if (!paid) await bumpUsage(adminSupabase, user.id, profile?.customization as Record<string, unknown> | null, "scans");
    return NextResponse.json({ ...extracted, scansRemaining: paid ? null : Math.max(0, PLAN_LIMITS.FREE_SCANS_PER_MONTH - (readUsage(profile?.customization).scans + 1)) });
  } catch {
    return NextResponse.json({});
  }
}
