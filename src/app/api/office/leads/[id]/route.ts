import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireOfficeCapability } from "@/lib/office-roles";
import { getOfficeLeads, isLeadStatusValue } from "@/lib/office-leads";

// PATCH /api/office/leads/[id] { status }
//
// Lets an Office admin mark a team lead Contacted / Closed / Not interested from
// the Leads tab. Needed as its own route because /api/leads/[id] authorizes the
// CARD OWNER — an employee's lead belongs to the employee, so the office owner
// is correctly rejected there.
//
// Authorization is explicit and never trusts the client: the caller must hold
// view_org_analytics in an office, and the lead id must be one this office
// actually owns. `getOfficeLeads` is the same scoped query the Leads tab renders
// from (current team + leads tagged at removal time), so a lead id from another
// org can't be patched by pasting it in.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOfficeCapability(user.id, "view_org_analytics");
  if (!ctx) return NextResponse.json({ error: "You don't have permission to manage these leads." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const status = body.status;
  if (!isLeadStatusValue(status)) {
    return NextResponse.json({ error: "That isn't a status we recognise." }, { status: 400 });
  }

  const leads = await getOfficeLeads(ctx.officeId);
  if (!leads.some((l) => l.id === id)) {
    return NextResponse.json({ error: "That lead isn't part of your team." }, { status: 404 });
  }

  const { error } = await getAdminSupabase().from("leads").update({ status }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Couldn't update that lead. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status });
}
