import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin";

// GET /api/admin/users/export — the full user directory as a CSV download
// (same rollups as the Users page: plan, source, cards, leads, views), for
// cohort checks, sales-call prep, or reconciling with payment records.

// RFC 4180 field escaping — quote when needed, double internal quotes.
// ALSO neutralizes spreadsheet formula injection: a user-controlled name like
// `=HYPERLINK(...)` or `=cmd|...` would otherwise execute when an admin opens
// the export in Excel/Sheets. A leading ' makes Excel treat it as text.
function csv(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = getAdminSupabase();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, name, email, plan, created_at, company, customization, signup_source, plan_expires_at, referral_code")
    .order("created_at", { ascending: false });

  const [{ data: cardRows }, { data: leadRows }, { data: viewRows }] = await Promise.all([
    admin.from("cards").select("user_id, username"),
    admin.from("leads").select("card_owner"),
    admin.from("card_views").select("username"),
  ]);

  const cardsByUser: Record<string, string[]> = {};
  for (const c of cardRows ?? []) (cardsByUser[c.user_id as string] ??= []).push(c.username as string);

  const leadsByUsername: Record<string, number> = {};
  for (const l of leadRows ?? []) {
    const o = (l.card_owner as string) || "";
    if (o) leadsByUsername[o] = (leadsByUsername[o] ?? 0) + 1;
  }

  const viewsByUsername: Record<string, number> = {};
  for (const v of viewRows ?? []) {
    const u = ((v.username as string) || "").replace(/__links$/, "");
    if (u) viewsByUsername[u] = (viewsByUsername[u] ?? 0) + 1;
  }

  const header = ["email", "name", "company", "plan", "plan_expires_at", "signup_source", "referral_code", "cards", "leads", "views", "signed_up"];
  const lines = [header.join(",")];

  for (const p of profiles ?? []) {
    if ((p.customization as { _deleted?: boolean } | null)?._deleted) continue;
    const usernames = new Set<string>([p.username as string, ...(cardsByUser[p.id as string] ?? [])].filter(Boolean));
    let leads = 0, views = 0;
    for (const u of usernames) {
      leads += leadsByUsername[u] ?? 0;
      views += viewsByUsername[u] ?? 0;
    }
    lines.push([
      csv(p.email), csv(p.name), csv(p.company),
      csv(p.plan), csv(p.plan_expires_at ?? ""), csv(p.signup_source ?? "direct"), csv(p.referral_code ?? ""),
      csv((cardsByUser[p.id as string] ?? []).length), csv(leads), csv(views),
      csv(String(p.created_at ?? "").slice(0, 10)),
    ].join(","));
  }

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="swiftcard-users-${today}.csv"`,
    },
  });
}
