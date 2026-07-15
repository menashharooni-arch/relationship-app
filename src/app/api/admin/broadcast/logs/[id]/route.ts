import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin";

const PAGE_SIZE = 100;

// GET /api/admin/broadcast/logs/[id] → one campaign's full message + its
// per-recipient outcomes (paginated, searchable by email). Site-owner only.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(0, Number(searchParams.get("page")) || 0);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);

  const admin = getAdminSupabase();
  const { data: campaign, error } = await admin
    .from("admin_email_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let recipients = admin
    .from("email_logs")
    .select("email, status, error, resend_id, created_at", { count: "exact" })
    .eq("campaign_id", id)
    .order("created_at", { ascending: true })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (q) recipients = recipients.ilike("email", `%${q}%`);

  const { data: rows, count } = await recipients;

  return NextResponse.json({
    campaign,
    recipients: rows ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}
