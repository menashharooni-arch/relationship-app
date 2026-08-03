import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { buildVCard } from "@/lib/vcard";
import { isPaidPlan, LOCKED_LEAD_TAG } from "@/lib/plan";

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("id");
  if (!leadId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = getAdminSupabase();

  let lead: { name: string; phone: string | null; email: string | null; company: string | null } | null = null;

  if (user) {
    const { data: profile } = await admin.from("profiles").select("username, plan").eq("id", user.id).single();
    const { data: extraCards } = await admin.from("cards").select("username").eq("user_id", user.id);
    const usernames = [profile?.username, ...(extraCards ?? []).map((c: { username: string }) => c.username)].filter(Boolean);

    const { data } = await admin.from("leads").select("name, phone, email, company, tags").eq("id", leadId).in("card_owner", usernames).single();
    // Ownership was checked here; the Free-plan LOCK was not. Leads captured
    // past the monthly cap carry sc-locked — the dashboard filters them out,
    // /contacts filters them out, and CSV export is Pro-gated — but this route
    // returned a full vCard for any lead id the account owned. So an account
    // that downgraded (and knows the ids from when it was Pro) could still pull
    // the phone and email of contacts it can no longer see. Withheld as "not
    // found" below, matching how every other surface treats a locked lead.
    const locked = Array.isArray(data?.tags) && data.tags.includes(LOCKED_LEAD_TAG);
    lead = locked && !isPaidPlan(profile?.plan as string | null) ? null : data;
  }

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Shared builder handles RFC 6350 escaping — these fields are VISITOR-supplied,
  // so a name with an embedded newline or ";" could otherwise inject arbitrary
  // vCard fields into the contact saved on the owner's phone. A captured lead has
  // no headshot, so PHOTO is simply omitted.
  const vcard = buildVCard({
    name: lead.name,
    company: lead.company,
    email: lead.email,
    phones: lead.phone ? [{ number: lead.phone, label: "mobile" }] : undefined,
  });

  const slug = lead.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  return new NextResponse(vcard, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.vcf"`,
    },
  });
}
