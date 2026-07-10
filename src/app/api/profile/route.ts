import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isPaidPlan, sanitizeCustomizationForPlan } from "@/lib/plan";

const ALLOWED = ["template", "name", "title", "company", "phone", "email", "website", "linkedin", "instagram", "twitter", "tiktok", "customization"];

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key];
  }

  // Enforce Pro-only design gates server-side (accent/font + link cap + custom
  // template), so the legacy profile-card editor can't bypass them.
  const { data: planRow } = await supabase.from("profiles").select("plan, customization").eq("id", user.id).single();

  // A soft-deleted account's access token stays valid for its remaining
  // lifetime (signOut only revokes the refresh token) — block writes here too,
  // not just the page-level redirect.
  if ((planRow?.customization as Record<string, unknown> | null)?._deleted === true) {
    return NextResponse.json({ error: "This account has been deleted." }, { status: 403 });
  }

  if (!isPaidPlan(planRow?.plan)) {
    if (updates.template === "custom") updates.template = "classic-pro";
    if ("customization" in updates) {
      updates.customization = sanitizeCustomizationForPlan(updates.customization as Record<string, unknown>, false);
    }
  }

  // Internal bookkeeping keys on customization (_aiDrafts, _trialStarted, …) are
  // server-owned: always carry the CURRENT values, never what the client sent.
  if ("customization" in updates) {
    const incoming = { ...(updates.customization as Record<string, unknown> ?? {}) };
    const current = (planRow?.customization ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(incoming)) if (key.startsWith("_")) delete incoming[key];
    for (const [key, val] of Object.entries(current)) if (key.startsWith("_")) incoming[key] = val;
    updates.customization = incoming;
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
