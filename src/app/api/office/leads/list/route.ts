import { NextRequest, NextResponse } from "next/server";
import { requireOfficeCapability } from "@/lib/office-roles";
import { getOfficeLeads, OFFICE_LEADS_PAGE } from "@/lib/office-leads";

// GET /api/office/leads/list?offset=200 → the next page of the office's leads.
//
// The Leads tab renders its first page server-side; this is what "Load more"
// calls. Same scoping and the same shape, so the table appends rows it already
// knows how to draw.
//
// Authorization is view_org_analytics via requireOfficeCapability — the same
// capability the Leads tab itself is gated on, which also re-checks that the
// office owner is still on a paid Office plan. Never trust a client-supplied
// office id: the office is resolved from the session.
export async function GET(req: NextRequest) {
  const { createClient } = await import("@/lib/supabase-server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOfficeCapability(user.id, "view_org_analytics");
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = Number(req.nextUrl.searchParams.get("offset"));
  const offset = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;

  try {
    const page = await getOfficeLeads(ctx.officeId, { offset, limit: OFFICE_LEADS_PAGE });
    return NextResponse.json(page);
  } catch {
    // The table keeps what it already has and shows a retry — never a wiped
    // list because one page failed.
    return NextResponse.json({ error: "Couldn't load more leads. Please try again." }, { status: 500 });
  }
}
