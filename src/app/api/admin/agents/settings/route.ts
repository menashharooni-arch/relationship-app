import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminSupabase } from "@/lib/supabase-admin";

// Per-agent + system settings, editable from the UI without a deploy.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null) as
    | { agent_id?: string; enabled?: boolean; output_cap?: number; usage_cap_tokens?: number; schedule?: string | null;
        system?: { monthly_usage_cap_tokens?: number; digest_email?: string; auto_pause_at?: string | null } }
    | null;
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const admin = getAdminSupabase();
  if (body.system) {
    await admin.from("agent_system").update({ ...body.system, updated_at: new Date().toISOString() }).eq("id", true);
    return NextResponse.json({ ok: true });
  }
  if (!body.agent_id) return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (Number.isFinite(body.output_cap)) patch.output_cap = Math.max(1, Math.min(200, Number(body.output_cap)));
  if (Number.isFinite(body.usage_cap_tokens)) patch.usage_cap_tokens = Math.max(50_000, Math.min(10_000_000, Math.round(Number(body.usage_cap_tokens))));
  if (body.schedule !== undefined) patch.schedule = body.schedule || null;
  await admin.from("agent_settings").update(patch).eq("agent_id", body.agent_id);
  return NextResponse.json({ ok: true });
}
