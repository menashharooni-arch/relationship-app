import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin";

// GET /api/admin/broadcast/logs → campaign history for the "View sent emails"
// modal. Site-owner admin only (same gate as sending). Newest first.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const admin = getAdminSupabase();
  const { data, error, count } = await admin
    .from("admin_email_campaigns")
    .select("id, sent_by, segment, subject, intended_count, sent_count, failed_count, skipped_count, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    // Table not migrated yet — tell the UI so it can point at the SQL file
    // instead of showing a raw database error.
    return NextResponse.json({ ready: false, campaigns: [], total: 0 });
  }

  return NextResponse.json({ ready: true, campaigns: data ?? [], total: count ?? 0 });
}
