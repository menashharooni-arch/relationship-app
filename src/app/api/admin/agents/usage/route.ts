import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminSupabase } from "@/lib/supabase-admin";

// The owner's Claude-plan usage for the Agent Flow meter.
// Live when CLAUDE_CODE_OAUTH_TOKEN is set in Vercel; otherwise falls back to
// the snapshot the runners write to agent_system after every run (they hold
// the same token as a GitHub Actions secret).
type Window = { utilization: number; resets_at: string | null } | null;

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const tok = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (tok) {
    try {
      const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
        headers: { Authorization: `Bearer ${tok}`, "anthropic-beta": "oauth-2025-04-20" },
        cache: "no-store",
      });
      if (res.ok) {
        const u = (await res.json()) as { five_hour?: Window; seven_day?: Window };
        const pick = (w?: Window) => (w ? { utilization: w.utilization, resets_at: w.resets_at } : null);
        return NextResponse.json({ source: "live", five_hour: pick(u.five_hour), seven_day: pick(u.seven_day), captured_at: new Date().toISOString() });
      }
    } catch { /* fall through to snapshot */ }
  }
  try {
    const { data } = await getAdminSupabase().from("agent_system").select("claude_usage").limit(1).single();
    const snap = data?.claude_usage as { five_hour: Window; seven_day: Window; captured_at: string } | null;
    if (snap?.captured_at) return NextResponse.json({ source: "snapshot", ...snap });
  } catch { /* none */ }
  return NextResponse.json({ source: "none" });
}
